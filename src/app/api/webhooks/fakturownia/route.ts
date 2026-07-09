import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyBearerToken } from "@/lib/integrations/fakturownia/auth";

/**
 * Fakturownia webhook receiver.
 *
 * Realne webhooki Fakturowni (zweryfikowane z dokumentacją 2026-07):
 * eventy TYLKO invoice:create/update/destroy + client:*. Dokumentów MM nie
 * emitują — sygnałem sprzedaży jest invoice:create (paragon/faktura
 * wystawiana przez SellAsist przy sprzedaży). Autoryzacja: Bearer token.
 * Match pozycji: positions[].code == products.sku (push ustawia code=SKU),
 * fallback positions[].product_id == products.fakturownia_product_id.
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

  // 2) Autoryzacja: Bearer token (Fakturownia nie podpisuje HMAC-em).
  const verify = verifyBearerToken(req.headers.get("authorization"));

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
    if (event.kind === "invoice_sale" || event.kind === "mm_sale" || event.kind === "warehouse_movement") {
      const r = await handleSale(event, eventRowId ?? "");
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
  positions: Array<{ sku: string; fakturowniaProductId: number | null; quantity: number }>;
  raw: Record<string, unknown>;
};

/**
 * Próbuje wyciągnąć kluczowe pola niezależnie od dokładnego shape payloadu.
 * To miejsce do iteracji gdy widzimy realny payload z Fakturowni.
 */
/** Sprzedażowe rodzaje dokumentów Fakturowni (invoice.kind). */
const SALE_KINDS = new Set(["vat", "receipt", "bill", "final", "kp"]);

function parseEvent(payload: Record<string, unknown>): ParsedEvent {
  // Fakturownia może opakować fakturę w { invoice: {...} } albo przysłać płasko.
  const inv = (payload.invoice ?? payload.document ?? payload) as Record<string, unknown>;

  const invId = inv.id != null ? String(inv.id) : "";
  const invKind = pickString(inv, "kind") ?? "";
  const eventName =
    pickString(payload, "event") ??
    pickString(payload, "event_type") ??
    pickString(payload, "type") ??
    "";

  // destroy/update nie są sygnałem sprzedaży — logujemy jako skipped.
  const isDestroy = /destroy|delete/i.test(eventName);
  const isInvoice = invId !== "" && ("positions" in inv || "number" in inv || invKind !== "");

  let kind = "unknown";
  if (isInvoice && !isDestroy && (SALE_KINDS.has(invKind) || invKind === "")) {
    kind = "invoice_sale";
  } else if (/mm|movement|magazyn|przesun/i.test(eventName)) {
    kind = "mm_sale";
  } else if (isInvoice) {
    kind = `invoice_${invKind || "other"}${isDestroy ? "_destroy" : ""}`;
  } else if (eventName) {
    kind = eventName;
  }

  // Idempotencja: Fakturownia nie wysyła event_id — budujemy deterministyczny
  // z rodzaju + id + updated_at (retry tego samego delivery = ten sam klucz;
  // invoice:update po zmianie = nowy klucz, ale handler RPC jest idempotentny).
  const updatedAt = pickString(inv, "updated_at") ?? "";
  const event_id = invId ? `${eventName || "invoice"}_${invId}_${updatedAt}` : pickString(payload, "event_id") ?? "";

  const doc_id = pickString(inv, "number") ?? invId;

  const positionsRaw = (inv.positions as Array<Record<string, unknown>> | undefined) ?? [];
  const positions = positionsRaw.map((p) => ({
    sku: pickString(p, "code") ?? pickString(p, "sku") ?? pickString(p, "product_code") ?? "",
    fakturowniaProductId: p.product_id != null && Number.isFinite(Number(p.product_id)) ? Number(p.product_id) : null,
    quantity: Number(p.quantity ?? p.qty ?? 1),
  })).filter((p) => p.sku || p.fakturowniaProductId != null);

  return { event_id, kind, doc_id, positions, raw: payload };
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/* ====================================================== */
/* Handlers per kind                                       */
/* ====================================================== */

async function handleSale(event: ParsedEvent, eventRowId: string): Promise<
  { ok: true; processed: number } | { ok: false; error: string }
> {
  if (event.positions.length === 0) {
    return { ok: false, error: "no_positions_in_document" };
  }

  const supabase = getServiceClient();
  let processed = 0;
  const errors: string[] = [];

  for (const pos of event.positions) {
    // Primary: code == products.sku (push ustawia code=SKU przy tworzeniu
    // produktu w Fakturowni). Fallback: product_id → fakturownia_product_id.
    let sku = pos.sku;
    if (!sku && pos.fakturowniaProductId != null) {
      const { data: prod } = await supabase
        .from("products")
        .select("sku")
        .eq("fakturownia_product_id", pos.fakturowniaProductId)
        .maybeSingle();
      sku = (prod?.sku as string | undefined) ?? "";
      if (!sku) {
        errors.push(`product_id=${pos.fakturowniaProductId}: brak w mapowaniu (fakturownia_product_id)`);
        continue;
      }
    }

    // RPC atomic + idempotent — ustawia status='sold', trigger DB
    // handle_product_sold domyka resztę (wallet, notyfikacje, sold_at, settlement_at).
    const { data, error } = await supabase.rpc("mark_product_sold_from_webhook", {
      p_sku: sku,
      p_mm_doc_id: event.doc_id,
      p_event_id: eventRowId,
    });
    if (error) {
      errors.push(`${sku}: ${error.message}`);
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
  const inv = (payload.invoice ?? payload.document ?? payload) as Record<string, unknown>;
  const positions = ((inv.positions as Array<Record<string, unknown>> | undefined) ?? []).map((p) => ({
    code: p.code ?? null,
    product_id: p.product_id ?? null,
    name: p.name ?? null,
    quantity: p.quantity ?? null,
  }));
  // Świadomie BEZ danych kupującego (buyer_*) — RODO/least privilege.
  return {
    event: payload.event ?? payload.event_type ?? null,
    id: inv.id ?? null,
    kind: inv.kind ?? null,
    number: inv.number ?? null,
    updated_at: inv.updated_at ?? null,
    positions,
  };
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
