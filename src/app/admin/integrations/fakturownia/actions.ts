"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function adminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["admin", "super_admin"].includes(prof?.role ?? "")) return null;
  return { supabase, userId: user.id };
}

export async function addWarehouseMapping(formData: FormData): Promise<Result> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const klientId = String(formData.get("klient_id") || "").trim();
  const warehouseIdRaw = String(formData.get("warehouse_id") || "").trim();
  const warehouseName = String(formData.get("warehouse_name") || "").trim() || null;

  const warehouseId = parseInt(warehouseIdRaw, 10);
  if (!klientId) return { ok: false, error: "Wybierz klienta." };
  if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
    return { ok: false, error: "Podaj prawidłowy fakturownia_warehouse_id." };
  }

  const { error } = await ctx.supabase
    .from("fakturownia_warehouse_map")
    .upsert(
      {
        klient_id: klientId,
        fakturownia_warehouse_id: warehouseId,
        warehouse_name: warehouseName,
      },
      { onConflict: "klient_id" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/integrations/fakturownia");
  return { ok: true, message: "Mapowanie zapisane." };
}

export async function removeWarehouseMapping(klientId: string): Promise<Result> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const { error } = await ctx.supabase
    .from("fakturownia_warehouse_map")
    .delete()
    .eq("klient_id", klientId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/integrations/fakturownia");
  return { ok: true };
}

export async function replayPushQueueItem(itemId: string): Promise<Result> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const { data: item } = await ctx.supabase
    .from("fakturownia_push_queue")
    .select("product_id, attempts")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Pozycja nie istnieje." };

  const { pushProductToFakturownia } = await import("@/lib/integrations/fakturownia/push");
  const r = await pushProductToFakturownia(item.product_id);

  if (r.ok) {
    await ctx.supabase
      .from("fakturownia_push_queue")
      .update({
        status: "done",
        attempts: item.attempts + 1,
        last_error: null,
      })
      .eq("id", itemId);
    revalidatePath("/admin/integrations/fakturownia");
    return { ok: true, message: r.skipped ? "Już było pushed — oznaczono jako done." : "Push się powiódł." };
  }

  await ctx.supabase
    .from("fakturownia_push_queue")
    .update({
      status: "failed",
      attempts: item.attempts + 1,
      last_error: r.error.message,
      next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    .eq("id", itemId);
  revalidatePath("/admin/integrations/fakturownia");
  return { ok: false, error: r.error.message };
}

export async function replayWebhookEvent(eventId: string): Promise<Result> {
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const { data: event } = await ctx.supabase
    .from("fakturownia_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { ok: false, error: "Event nie istnieje." };

  // Re-process tylko mm_sale na razie. Inne kind'y wymagają osobnego handlera.
  if (event.event_kind !== "mm_sale" && event.event_kind !== "warehouse_movement") {
    await ctx.supabase
      .from("fakturownia_events")
      .update({
        status: "skipped",
        error_message: `replay_unhandled_kind:${event.event_kind}`,
      })
      .eq("id", eventId);
    return { ok: false, error: `Nieobsługiwany kind: ${event.event_kind}` };
  }

  const positions = (event.payload?.positions ?? event.payload?.document?.positions ?? []) as Array<{
    sku?: string; code?: string; product_code?: string; quantity?: number;
  }>;

  if (positions.length === 0) {
    await ctx.supabase
      .from("fakturownia_events")
      .update({ status: "failed", error_message: "no_positions_on_replay" })
      .eq("id", eventId);
    return { ok: false, error: "Brak pozycji w payloadzie." };
  }

  const docId = String(event.payload?.document?.id ?? event.payload?.document_id ?? "REPLAY");
  let processed = 0;
  const errors: string[] = [];

  for (const pos of positions) {
    const sku = pos.sku || pos.code || pos.product_code;
    if (!sku) continue;
    const { error } = await ctx.supabase.rpc("mark_product_sold_from_webhook", {
      p_sku: sku,
      p_mm_doc_id: docId,
      p_event_id: eventId,
    });
    if (error) errors.push(`${sku}: ${error.message}`);
    else processed += 1;
  }

  const newStatus = processed > 0 ? "replayed" : "failed";
  await ctx.supabase
    .from("fakturownia_events")
    .update({
      status: newStatus,
      error_message: errors.join("; ") || null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  revalidatePath("/admin/integrations/fakturownia");

  if (processed === 0) return { ok: false, error: errors.join("; ") || "Replay failed." };
  return { ok: true, message: `Replayed ${processed} pozycji.` };
}
