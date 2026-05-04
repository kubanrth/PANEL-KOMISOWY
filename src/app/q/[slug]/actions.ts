"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsePriceToCents } from "@/lib/format";

export async function submitBuyerOffer(formData: FormData) {
  const supabase = await createClient();

  const productId = String(formData.get("product_id") || "");
  const slug = String(formData.get("slug") || "");
  const amount = String(formData.get("amount") || "");
  const buyerName = String(formData.get("buyer_name") || "").trim() || "Anonim";
  const email = String(formData.get("email") || "").trim() || null;
  const message = String(formData.get("message") || "").trim() || null;

  const cents = parsePriceToCents(amount);
  if (!productId || !cents || cents <= 0) {
    redirect(`/q/${slug}?error=invalid`);
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, brand, model, listing_price_cents, status, submission_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) redirect(`/q/${slug}?error=notfound`);

  if (product.status !== "listed" && product.status !== "offer") {
    redirect(`/q/${slug}?error=unavailable`);
  }

  // Insert offer (anonymous buyer)
  const buyerToken = crypto.randomUUID();
  await supabase.from("offers").insert({
    product_id: productId,
    amount_cents: cents,
    buyer_name: buyerName,
    buyer_token: buyerToken,
    message: message ? `${message}${email ? ` · email: ${email}` : ""}` : email ? `email: ${email}` : null,
    status: "pending",
    is_seller_message: false,
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });

  // Update product status to "offer" if it was just listed
  if (product.status === "listed") {
    await supabase.from("products").update({ status: "offer" }).eq("id", productId);
  }

  // Notify klient
  const { data: sub } = await supabase.from("submissions").select("klient_id").eq("id", product.submission_id).maybeSingle();
  if (sub) {
    await supabase.from("notifications").insert({
      user_id: sub.klient_id,
      type: "offer_received",
      title: `Oferta z QR: ${product.brand} ${product.model}`,
      body: `${buyerName} proponuje ${(cents / 100).toFixed(0)} zł (lista ${(product.listing_price_cents! / 100).toFixed(0)} zł).`,
      ref_id: `PROD-${productId}`,
      payload: { offer_cents: cents, source: "qr_scan", buyer_name: buyerName },
    });
  }

  revalidatePath(`/q/${slug}`);
  redirect(`/q/${slug}/sent`);
}
