import "server-only";

import { getServiceClient } from "@/lib/supabase/service";
import { createFakturowniaProduct, withRetry, type FakturowniaError } from "./client";

/**
 * Push produktu z Kickback do magazynu komisanta w Fakturowni.
 *
 * Wywoływane z server action po A&QC pass (verdict='pass' w aqc_audits).
 * Idempotent: jeśli `products.fakturownia_product_id` jest już ustawione,
 * skipujemy (push już się powiódł wcześniej).
 *
 * Retry: 3x inline z exponential backoff (500ms, 1500ms, 4000ms). Jeśli
 * nadal failuje — zapis do `fakturownia_push_queue` z `status='failed'`
 * + notyfikacja admina. Admin może replay z UI.
 */
export async function pushProductToFakturownia(
  productId: string,
): Promise<
  | { ok: true; fakturowniaProductId: number; skipped?: boolean }
  | { ok: false; error: FakturowniaError; queued: boolean }
> {
  const supabase = getServiceClient();

  // Pull product + submission (commission) + warehouse mapping in parallel.
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, sku, brand, model, vat_rate, expected_price_cents, listing_price_cents, " +
        "description, status, submission_id, fakturownia_product_id",
    )
    .eq("id", productId)
    .maybeSingle();

  if (prodErr || !product) {
    return {
      ok: false,
      error: { code: "http_error", message: `Product not found: ${prodErr?.message ?? "—"}` },
      queued: false,
    };
  }

  // Idempotency: already pushed → skip.
  if (product.fakturownia_product_id) {
    return { ok: true, fakturowniaProductId: Number(product.fakturownia_product_id), skipped: true };
  }

  // Lookup klient → warehouse mapping via submission.
  const { data: sub } = await supabase
    .from("submissions")
    .select("klient_id")
    .eq("id", product.submission_id)
    .maybeSingle();

  if (!sub) {
    return {
      ok: false,
      error: { code: "http_error", message: "Submission not found for product." },
      queued: false,
    };
  }

  const { data: warehouse } = await supabase
    .from("fakturownia_warehouse_map")
    .select("fakturownia_warehouse_id")
    .eq("klient_id", sub.klient_id)
    .maybeSingle();

  if (!warehouse) {
    // No mapping yet — enqueue and notify admin to configure.
    await enqueue(productId, "no_warehouse_mapping_for_klient");
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: `Brak mapowania magazynu dla klienta ${sub.klient_id}. Skonfiguruj w /admin/integrations/fakturownia.`,
      },
      queued: true,
    };
  }

  // Build product name + push with retry.
  const name = `${product.brand} ${product.model}`.trim();
  const priceGross = product.listing_price_cents ?? product.expected_price_cents ?? 0;

  const result = await withRetry(() =>
    createFakturowniaProduct({
      warehouseId: Number(warehouse.fakturownia_warehouse_id),
      sku: product.sku as string,
      name,
      priceGrossCents: priceGross,
      vatRate: Number(product.vat_rate ?? 0.23),
      description: (product.description as string | null) ?? undefined,
    }),
  );

  if (!result.ok) {
    await enqueue(productId, JSON.stringify(result.error));
    return { ok: false, error: result.error, queued: true };
  }

  const fakturowniaId = result.data.id;

  // Persist link + timestamp on products row.
  const { error: updErr } = await supabase
    .from("products")
    .update({
      fakturownia_product_id: fakturowniaId,
      fakturownia_pushed_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updErr) {
    // Push succeeded in Fakturownia but we couldn't persist locally.
    // Log and queue for replay — replay is idempotent (skip if already linked).
    await enqueue(productId, `local_link_failed:${updErr.message}`);
  }

  // Send notification to klient (best-effort, ignore errors).
  await supabase.from("notifications").insert({
    user_id: sub.klient_id,
    type: "valuation_ready",
    title: "Twój produkt wystawiony w sprzedaży",
    body: `${name} (SKU ${product.sku}) jest już aktywny w magazynie Kickback.`,
    payload: {
      product_id: productId,
      sku: product.sku,
      fakturownia_product_id: fakturowniaId,
    } as Record<string, unknown>,
  });

  return { ok: true, fakturowniaProductId: fakturowniaId };
}

async function enqueue(productId: string, reason: string) {
  const supabase = getServiceClient();
  await supabase.from("fakturownia_push_queue").insert({
    product_id: productId,
    attempts: 1,
    last_error: reason,
    status: "failed",
    next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
  });
}
