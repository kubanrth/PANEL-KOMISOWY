"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function adminGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || !["admin", "super_admin"].includes(prof.role)) return null;
  return { supabase, user };
}

export async function createBuyerOffer(formData: FormData) {
  const ctx = await adminGuard();
  if (!ctx) return;
  const productId = String(formData.get("product_id") || "");
  if (!productId) return;

  const { data: product } = await ctx.supabase
    .from("products")
    .select("id, brand, model, listing_price_cents, submission_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product || !product.listing_price_cents) return;

  // Buyer offer = 88% of listing
  const offerAmount = Math.round(product.listing_price_cents * 0.88);

  await ctx.supabase.from("offers").insert({
    product_id: productId,
    amount_cents: offerAmount,
    buyer_name: "Anonim #" + Math.floor(1000 + Math.random() * 9000),
    buyer_token: crypto.randomUUID(),
    status: "pending",
    is_seller_message: false,
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    message: "Zainteresowany — czy 88% byłoby OK?",
  });

  await ctx.supabase.from("products").update({ status: "offer" }).eq("id", productId);

  // Notify klient
  const { data: sub } = await ctx.supabase.from("submissions").select("klient_id").eq("id", product.submission_id).maybeSingle();
  if (sub) {
    await ctx.supabase.from("notifications").insert({
      user_id: sub.klient_id,
      type: "offer_received",
      title: `Nowa oferta: ${product.brand} ${product.model}`,
      body: `Kupujący proponuje ${(offerAmount / 100).toFixed(0)} zł (lista ${(product.listing_price_cents / 100).toFixed(0)} zł).`,
      ref_id: `PROD-${productId}`,
      payload: { offer_cents: offerAmount },
    });
  }

  revalidatePath("/admin/offers");
  redirect(`/admin/offers/${productId}`);
}

export async function adminCounterOffer(formData: FormData) {
  const ctx = await adminGuard();
  if (!ctx) return;
  const productId = String(formData.get("product_id") || "");
  const amountCents = parseInt(String(formData.get("amount_cents") || "0"), 10);
  const message = String(formData.get("message") || "").trim() || null;

  if (!productId || !amountCents || amountCents <= 0) return;

  // Find latest active offer
  const { data: parent } = await ctx.supabase
    .from("offers")
    .select("id, status")
    .eq("product_id", productId)
    .in("status", ["pending", "countered"])
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

  revalidatePath(`/admin/offers/${productId}`);
}
