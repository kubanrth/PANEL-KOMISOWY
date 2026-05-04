"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function clientGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export async function acceptOffer(formData: FormData) {
  const ctx = await clientGuard();
  if (!ctx) return;
  const offerId = String(formData.get("offer_id") || "");
  if (!offerId) return;

  const { data: offer } = await ctx.supabase
    .from("offers")
    .select("id, product_id, amount_cents, status, products!inner ( submission_id, brand, model, submissions!inner ( klient_id ) )")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return;

  type OfferData = { id: string; product_id: string; amount_cents: number; status: string; products: { submission_id: string; brand: string; model: string; submissions: { klient_id: string } } };
  const o = offer as unknown as OfferData;
  if (o.products.submissions.klient_id !== ctx.user.id) return;

  // Mark offer accepted
  await ctx.supabase.from("offers").update({
    status: "accepted",
    responded_at: new Date().toISOString(),
    responded_by: ctx.user.id,
  }).eq("id", offerId);

  // Mark product sold + update listing price
  await ctx.supabase
    .from("products")
    .update({ status: "sold", listing_price_cents: o.amount_cents })
    .eq("id", o.product_id);

  // Trigger handle_product_sold pushes wallet_transactions(sale_pending) automatically.

  revalidatePath(`/panel/offers/${o.product_id}`);
  revalidatePath(`/panel/products/${o.product_id}`);
  revalidatePath("/panel");
  revalidatePath("/panel/wallet");
  revalidatePath("/admin/offers");
}

export async function rejectOffer(formData: FormData) {
  const ctx = await clientGuard();
  if (!ctx) return;
  const offerId = String(formData.get("offer_id") || "");
  if (!offerId) return;

  const { data: offer } = await ctx.supabase
    .from("offers")
    .select("product_id, products!inner ( submissions!inner ( klient_id ) )")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return;
  type OfferData = { product_id: string; products: { submissions: { klient_id: string } } };
  const o = offer as unknown as OfferData;
  if (o.products.submissions.klient_id !== ctx.user.id) return;

  await ctx.supabase.from("offers").update({
    status: "rejected",
    responded_at: new Date().toISOString(),
    responded_by: ctx.user.id,
  }).eq("id", offerId);

  // Bring product back to listed
  await ctx.supabase.from("products").update({ status: "listed" }).eq("id", o.product_id);

  revalidatePath(`/panel/offers/${o.product_id}`);
}

export async function sellerCounterOffer(formData: FormData) {
  const ctx = await clientGuard();
  if (!ctx) return;
  const productId = String(formData.get("product_id") || "");
  const amountCents = parseInt(String(formData.get("amount_cents") || "0"), 10);
  const message = String(formData.get("message") || "").trim() || null;

  if (!productId || !amountCents) return;

  // Verify ownership
  const { data: product } = await ctx.supabase
    .from("products")
    .select("submission_id, submissions!inner ( klient_id )")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return;
  type Owner = { submissions: { klient_id: string } };
  if ((product as unknown as Owner).submissions.klient_id !== ctx.user.id) return;

  // Find latest pending buyer offer
  const { data: parent } = await ctx.supabase
    .from("offers")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "pending")
    .eq("is_seller_message", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (parent) {
    await ctx.supabase.from("offers").update({
      status: "countered",
      responded_at: new Date().toISOString(),
      responded_by: ctx.user.id,
    }).eq("id", parent.id);
  }

  await ctx.supabase.from("offers").insert({
    product_id: productId,
    amount_cents: amountCents,
    parent_offer_id: parent?.id ?? null,
    message,
    status: "pending",
    is_seller_message: true,
    responded_by: ctx.user.id,
  });

  revalidatePath(`/panel/offers/${productId}`);
}
