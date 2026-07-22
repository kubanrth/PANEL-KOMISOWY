"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Decyzja admina o nowej ofercie produktowej komisanta (intake):
 * - accept  → listing = cena oczekiwana klienta
 * - counter → listing = kontroferta admina (counterCents)
 * - reject  → produkt odrzucony: status 'returned' + wpis w returns
 *   (reason below_standards, bez opłaty) — trafia do Zwrotów u klienta.
 * Każda decyzja notyfikuje właściciela.
 */
export async function decideProductOffer(
  productId: string,
  decision: "accept" | "counter" | "reject",
  counterCents?: number,
): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Brak sesji." };

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin" && prof?.role !== "super_admin") {
    return { ok: false, error: "Brak uprawnień." };
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, brand, model, status, expected_price_cents, listing_price_cents, submissions ( klient_id )")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produkt nie istnieje." };
  if (product.listing_price_cents != null) return { ok: false, error: "Oferta już zdecydowana." };
  if (!["draft", "aqc"].includes(product.status as string)) {
    return { ok: false, error: "Produkt nie jest już na etapie oferty." };
  }
  const sub = Array.isArray(product.submissions) ? product.submissions[0] : product.submissions;
  const klientId = (sub as { klient_id?: string } | null)?.klient_id;
  const name = `${product.brand} ${product.model}`;

  if (decision === "reject") {
    const { error: rErr } = await supabase.from("returns").insert({
      product_id: product.id,
      reason: "below_standards",
      fee_cents: 0,
      initiated_by: user.id,
      resolution: "pending",
      notes: "Odrzucenie oferty produktowej na intake (panel Oferty).",
    });
    if (rErr) return { ok: false, error: rErr.message };
    const { error: pErr } = await supabase.from("products").update({ status: "returned" }).eq("id", product.id);
    if (pErr) return { ok: false, error: pErr.message };
    if (klientId) {
      await supabase.from("notifications").insert({
        user_id: klientId,
        type: "return_decision",
        title: `Oferta odrzucona: ${name}`,
        body: "Produkt nie spełnia kryteriów Kickback. Szczegóły w zakładce Zwroty.",
        ref_id: product.id,
      });
    }
  } else {
    const price = decision === "accept" ? product.expected_price_cents : counterCents;
    if (!price || price <= 0) return { ok: false, error: "Nieprawidłowa cena." };
    const { error: uErr } = await supabase
      .from("products")
      .update({ listing_price_cents: price })
      .eq("id", product.id);
    if (uErr) return { ok: false, error: uErr.message };
    if (klientId) {
      await supabase.from("notifications").insert({
        user_id: klientId,
        type: "valuation_ready",
        title: decision === "accept" ? `Wycena zaakceptowana: ${name}` : `Kontroferta cenowa: ${name}`,
        body:
          decision === "accept"
            ? `Przyjęliśmy Twoją cenę ${((price) / 100).toFixed(0)} zł — produkt idzie do przygotowania.`
            : `Proponujemy ${((price) / 100).toFixed(0)} zł (Twoja: ${((product.expected_price_cents ?? 0) / 100).toFixed(0)} zł). Nie zgadzasz się? Odpowiedz przez Zmianę ceny w Magazynie po wystawieniu albo napisz do nas.`,
        ref_id: product.id,
      });
    }
  }

  revalidatePath("/admin/oferty");
  return { ok: true };
}
