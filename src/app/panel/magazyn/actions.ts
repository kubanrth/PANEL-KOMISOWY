"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Klient sugeruje nową cenę dla swojego produktu. Wpada do
 * price_change_requests jako pending; admin akceptuje/odrzuca w
 * /admin/zmiany-ceny (Faza 6).
 */
export async function requestPriceChange(
  productId: string,
  newPriceCents: number,
  notes?: string,
): Promise<ActionResult> {
  if (!productId) return { ok: false, error: "Brak ID produktu." };
  if (!Number.isFinite(newPriceCents) || newPriceCents <= 0) {
    return { ok: false, error: "Podaj poprawną cenę." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  // Get product owner check via RLS (klient widzi tylko swoje przez submission)
  const { data: product } = await supabase
    .from("products")
    .select("id, listing_price_cents, expected_price_cents, submission_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produkt nie znaleziony lub brak dostępu." };

  const currentPrice = product.listing_price_cents ?? product.expected_price_cents ?? null;

  const { error } = await supabase.from("price_change_requests").insert({
    product_id: productId,
    requested_by: user.id,
    current_price_cents: currentPrice,
    suggested_price_cents: newPriceCents,
    notes: notes?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  // Wpis do historii powiadomień klienta — celowo non-blocking (błąd nie
  // blokuje wniosku). Wymaga policy notifications_insert_own (migracja 014).
  await supabase.from("notifications").insert({
    user_id: user.id, // klient widzi też swoją w historii
    type: "price_reduction_suggestion",
    title: "Wysłałeś sugestię zmiany ceny",
    body: `Nowa cena: ${(newPriceCents / 100).toFixed(0)} zł — oczekuje akceptacji administratora.`,
    payload: { product_id: productId, suggested_price_cents: newPriceCents } as Record<string, unknown>,
  });

  revalidatePath("/panel/magazyn");
  revalidatePath("/panel/zmiany-ceny");
  return { ok: true };
}

/**
 * Bulk withdraw — klient zaznacza pozycje do wycofania z komisu.
 * Polityka: <60d w magazynie → opłata 5% wartości (max 500 zł).
 * Tworzymy `returns` per produkt z reason=withdraw_short/long_term.
 */
export async function bulkRequestWithdrawal(
  productIds: string[],
): Promise<ActionResult & { fee_cents?: number }> {
  if (!productIds.length) return { ok: false, error: "Zaznacz co najmniej jeden produkt." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const { data: products } = await supabase
    .from("products")
    .select("id, brand, model, status, listing_price_cents, expected_price_cents, created_at, published_at")
    .in("id", productIds);

  if (!products?.length) return { ok: false, error: "Nie znaleziono produktów." };

  let totalFee = 0;
  const inserts = products.map((p) => {
    const sinceTs = p.published_at ?? p.created_at;
    const ageDays = Math.floor((Date.now() - new Date(sinceTs).getTime()) / 86_400_000);
    const isShortTerm = ageDays < 60;
    const value = p.listing_price_cents ?? p.expected_price_cents ?? 0;
    const rawFee = isShortTerm ? Math.round(value * 0.05) : 0;
    const cappedFee = Math.min(rawFee, 50_000); // 500 zł cap
    totalFee += cappedFee;
    const reason: "withdraw_short_term" | "withdraw_long_term" = isShortTerm
      ? "withdraw_short_term"
      : "withdraw_long_term";
    return {
      product_id: p.id,
      reason,
      fee_cents: cappedFee,
      initiated_by: user.id,
      resolution: "pending" as const,
      notes: "Bulk withdrawal request z panelu Magazyn.",
    };
  });

  const { error: rErr } = await supabase.from("returns").insert(inserts);
  if (rErr) return { ok: false, error: rErr.message };

  // Lock produkty: status → withdrawn
  const { error: pErr } = await supabase
    .from("products")
    .update({ status: "withdrawn" })
    .in("id", productIds);
  if (pErr) return { ok: false, error: pErr.message };

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "return_decision",
    title: `Wysłałeś prośbę o wycofanie ${productIds.length} pozycji`,
    body: totalFee > 0
      ? `Naliczona opłata administracyjna: ${(totalFee / 100).toFixed(0)} zł (5% wartości, max 500 zł).`
      : "Bez opłat — pozycje były w magazynie ponad 60 dni.",
    payload: { product_ids: productIds, fee_cents: totalFee } as Record<string, unknown>,
  });

  revalidatePath("/panel/magazyn");
  revalidatePath("/panel/zwroty");
  revalidatePath("/panel/komis-wyciagniety");
  return { ok: true, fee_cents: totalFee };
}

/** Pre-calculate withdrawal fee for UI confirmation (no mutation). */
export async function calculateWithdrawalFee(productIds: string[]): Promise<{
  total_fee_cents: number;
  total_value_cents: number;
  short_term_count: number;
  long_term_count: number;
}> {
  if (!productIds.length) {
    return { total_fee_cents: 0, total_value_cents: 0, short_term_count: 0, long_term_count: 0 };
  }
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, listing_price_cents, expected_price_cents, created_at, published_at")
    .in("id", productIds);

  let fee = 0;
  let value = 0;
  let shortCount = 0;
  let longCount = 0;
  for (const p of products ?? []) {
    const sinceTs = p.published_at ?? p.created_at;
    const ageDays = Math.floor((Date.now() - new Date(sinceTs).getTime()) / 86_400_000);
    const v = p.listing_price_cents ?? p.expected_price_cents ?? 0;
    value += v;
    if (ageDays < 60) {
      shortCount += 1;
      fee += Math.min(Math.round(v * 0.05), 50_000);
    } else {
      longCount += 1;
    }
  }
  return {
    total_fee_cents: fee,
    total_value_cents: value,
    short_term_count: shortCount,
    long_term_count: longCount,
  };
}
