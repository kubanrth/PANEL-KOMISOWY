import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyHmacSignature } from "@/lib/integrations/fakturownia/hmac";

/**
 * Fakturownia webhook receiver — przyjmuje wszystkie eventy z Fakturowni
 * i decyduje co zrobić na podstawie kind.
 *
 * **KRYTYCZNE:**
 * Zawsze zwracamy HTTP 200. Non-2xx powoduje Fakturownia retry, co
 * generuje duplikaty zdarzeń. Błędy logujemy do `fakturownia_events.status`
 * (failed / skipped) i pokazujemy adminowi z możliwością manual replay.
 *
 * **Schema payloadu — DEFENSIVE (do tuningu po pierwszym capture):**
 * Spodziewamy się czegoś w stylu:
 * ```json
 * {
 *   "event_id": "evt_abc123",
 *   "event_type": "warehouse_movement" | "mm_sale" | ...,
 *   "timestamp": 1234567890,
 *   "document": {
 *     "id": "MM-2026-001",
 *     "source_warehouse_id": 5,
 *     "target_warehouse_id": 1,
 *     "positions": [{ "code": "KCB-26-ABC123", "quantity": 1 }]
 *   }
 * }
 * ```
 * Jeśli realny payload różni się — dostosuj `parseEvent()` poniżej.
 *
 * **R1 z planu**: Daniel musi capture'ować realny payload z sandbox
 * Fakturownia. Bez tego matching SKU może chybić.
 */

export const runtime = "nodejs"; // Node runtime — potrzeba crypto.createHmac
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1) Raw body — HMAC liczone po niesparsowanym tekście.
  const rawBody = await req.text();

  // 2) Verify HMAC + timestamp window (5 min anti-replay).
  const verify = verifyHmacSignature(
    rawBody,
    req.headers.get("x-fakturownia-timestamp"),
    req.headers.get("x-fakturownia-signature"),
  );

  if (!verify.ok && verify.reason === "missing_secret") {
    // Misconfiguracja po naszej stronie — to NIE jest atak, więc 503.
    return NextResponse.json(
      { ok: false, error: "Server not configured (FAKTUROWNIA_WEBHOOK_SECRET missing)" },
      { status: 503 },
    );
  }

  // 3) Parse JSON (best-effort).
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    // Bad JSON — zaloguj jako event "malformed_payload" jeśli się da,
    // ale i tak zwróć 200.
    await tryLogMalformed(rawBody, "json_parse_failed");
    return NextResponse.json({ ok: true, note: "json_parse_failed_logged" });
  }

  // 4) Parse + dispatch.
  const event = parseEvent(payload);

  if (!event.event_id) {
    await tryLogMalformed(rawBody, "missing_event_id");
    return NextResponse.json({ ok: true, note: "missing_event_id" });
  }

  // 5) Idempotency: insert do fakturownia_events z ON CONFLICT DO NOTHING.
  //    Jeśli row już istnieje → drugi delivery, zwracamy 200 + skipped.
  const supabase = getServiceClient();

  const redactedPayload = redact(payload);
  const status = verify.ok ? "processed" : "failed"; // initial — moze sie zmienic
  const errorMessage = verify.ok ? null : `signature_${verify.reason}`;

  const { data: inserted, error: insertErr } = await supabase
    .from("fakturownia_events")
    .insert({
      fakturownia_event_id: event.event_id,
      event_kind: event.kind,
      payload: redactedPayload,
      signature_valid: verify.ok,
      status, // tymczasowy, update poniżej
      error_message: errorMessage,
    })
    .select("id")
    .maybeSingle();

  // Conflict (już mamy ten event_id) → drugie delivery, idempotency hit.
  if (insertErr && insertErr.code === "23505") {
    return NextResponse.json({ ok: true, note: "duplicate_event_skipped" });
  }
  if (insertErr) {
    // Nie mogliśmy nawet zapisać eventu. Logujemy do server-side error log
    // i zwracamy 200 (lepiej drop niż retry storm).
    console.error("[fakturownia/webhook] failed to log event:", insertErr);
    return NextResponse.json({ ok: true, note: "event_log_failed" });
  }

  const eventRowId = inserted?.id as string | undefined;

  // 6) Jeśli signature nieprawidłowy — nie ruszamy dalej.
  if (!verify.ok) {
    return NextResponse.json({ ok: true, note: `signature_${verify.reason}` });
  }

  // 7) Dispatch wg event kind.
  let processStatus: "processed" | "failed" | "skipped" = "skipped";
  let processError: string | null = null;

  try {
    if (event.kind === "mm_sale" || event.kind === "warehouse_movement") {
      const r = await handleMmSale(event, eventRowId ?? "");
      processStatus = r.ok ? "processed" : "failed";
      processError = r.ok ? null : r.error;
    } else {
      // Nieobsługiwany kind — zapisaliśmy do logu, ale nic nie robimy.
      processStatus = "skipped";
      processError = `unhandled_kind:${event.kind}`;
    }
  } catch (e) {
    processStatus = "failed";
    processError = e instanceof Error ? e.message : String(e);
  }

  // 8) Update final status na event row.
  if (eventRowId) {
    await supabase
      .from("fakturownia_events")
      .update({
        status: processStatus,
        error_message: processError,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRowId);
  }

  return NextResponse.json({ ok: true, status: processStatus });
}

/* ====================================================== */
/* Event parser                                            */
/* ====================================================== */

type ParsedEvent = {
  event_id: string;
  kind: string;
  doc_id: string;
  positions: Array<{ sku: string; quantity: number }>;
  raw: Record<string, unknown>;
};

/**
 * Próbuje wyciągnąć kluczowe pola niezależnie od dokładnego shape payloadu.
 * To miejsce do iteracji gdy widzimy realny payload z Fakturowni.
 */
function parseEvent(payload: Record<string, unknown>): ParsedEvent {
  const event_id =
    pickString(payload, "event_id") ??
    pickString(payload, "id") ??
    "";

  const kindRaw =
    pickString(payload, "event_type") ??
    pickString(payload, "kind") ??
    pickString(payload, "type") ??
    "unknown";

  const doc = (payload.document ?? payload.doc ?? {}) as Record<string, unknown>;
  const doc_id =
    pickString(doc, "id") ??
    pickString(doc, "number") ??
    pickString(payload, "document_id") ??
    "";

  // Normalizacja kind: każdy MM-doc traktujemy jako warehouse_movement,
  // dispatcher rozpozna kierunek po source_warehouse_id.
  const kind = /mm|movement|magazyn|przesun/i.test(kindRaw) ? "mm_sale" : kindRaw;

  const positionsRaw =
    (doc.positions as Array<Record<string, unknown>> | undefined) ??
    (payload.positions as Array<Record<string, unknown>> | undefined) ??
    [];

  const positions = positionsRaw.map((p) => ({
    sku: pickString(p, "code") ?? pickString(p, "sku") ?? pickString(p, "product_code") ?? "",
    quantity: Number(p.quantity ?? p.qty ?? 1),
  })).filter((p) => p.sku);

  return { event_id, kind, doc_id, positions, raw: payload };
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/* ====================================================== */
/* Handlers per kind                                       */
/* ====================================================== */

async function handleMmSale(event: ParsedEvent, eventRowId: string): Promise<
  { ok: true; processed: number } | { ok: false; error: string }
> {
  if (event.positions.length === 0) {
    return { ok: false, error: "no_positions_in_mm_doc" };
  }

  const supabase = getServiceClient();
  let processed = 0;
  const errors: string[] = [];

  for (const pos of event.positions) {
    // RPC atomic + idempotent — ustawia status='sold', trigger DB
    // handle_product_sold reszta domyka (wallet, notyfikacje, sold_at, settlement_at).
    const { data, error } = await supabase.rpc("mark_product_sold_from_webhook", {
      p_sku: pos.sku,
      p_mm_doc_id: event.doc_id,
      p_event_id: eventRowId,
    });
    if (error) {
      errors.push(`${pos.sku}: ${error.message}`);
      continue;
    }
    if (data) processed += 1;
  }

  if (errors.length > 0 && processed === 0) {
    return { ok: false, error: errors.join("; ") };
  }
  return { ok: true, processed };
}

/* ====================================================== */
/* Helpers                                                 */
/* ====================================================== */

/** Zachowaj tylko top-level fields żeby nie logować potencjalnych secret leakage. */
function redact(payload: Record<string, unknown>): Record<string, unknown> {
  const allowedKeys = ["event_id", "id", "event_type", "kind", "type", "timestamp", "document_id", "document", "positions"];
  const redacted: Record<string, unknown> = {};
  for (const k of allowedKeys) {
    if (k in payload) redacted[k] = payload[k];
  }
  return redacted;
}

async function tryLogMalformed(rawBody: string, reason: string) {
  try {
    const supabase = getServiceClient();
    await supabase.from("fakturownia_events").insert({
      fakturownia_event_id: `malformed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event_kind: "malformed",
      payload: { reason, body_preview: rawBody.slice(0, 500) },
      signature_valid: false,
      status: "failed",
      error_message: reason,
    });
  } catch {
    // Jeśli nawet to zawiedzie — nic nie zrobimy, zwracamy 200.
  }
}
