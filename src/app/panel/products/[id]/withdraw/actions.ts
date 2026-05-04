"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RETURN_REASON_LABEL, type ReturnReason } from "@/lib/types";

export async function withdrawProduct(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesja wygasła." };

  const productId = String(formData.get("product_id") || "");
  const reason = String(formData.get("reason") || "") as ReturnReason;
  if (!productId || !RETURN_REASON_LABEL[reason]) return { ok: false, error: "Nieprawidłowe dane." };

  const reasonInfo = RETURN_REASON_LABEL[reason];

  // Verify ownership
  const { data: product } = await supabase
    .from("products")
    .select("id, brand, model, status, submission_id, submissions!inner(klient_id)")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produkt nie znaleziony." };
  type Owner = { submissions: { klient_id: string } };
  if ((product as unknown as Owner).submissions.klient_id !== user.id) {
    return { ok: false, error: "Brak uprawnień." };
  }

  if (product.status === "sold" || product.status === "returned" || product.status === "withdrawn") {
    return { ok: false, error: `Produkt nie może być wycofany w stanie: ${product.status}.` };
  }

  // Insert return
  const { error: retErr } = await supabase.from("returns").insert({
    product_id: productId,
    reason,
    fee_cents: reasonInfo.fee,
    decision_deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    resolution: "pending",
    initiated_by: user.id,
  });
  if (retErr) return { ok: false, error: retErr.message };

  // Mark product withdrawn
  await supabase.from("products").update({ status: "withdrawn" }).eq("id", productId);

  // Charge fee if any
  if (reasonInfo.fee > 0) {
    await supabase.from("wallet_transactions").insert({
      klient_id: user.id,
      type: "return_fee",
      amount_cents: -reasonInfo.fee,
      reference_id: `PROD-${productId}`,
      description: `Wycofanie: ${product.brand} ${product.model}`,
    });
  }

  // Audit
  await supabase.from("audit_log").insert({
    actor_id: user.id, action: "product_withdraw", target_type: "product", target_id: productId, payload: { reason, fee: reasonInfo.fee },
  });

  revalidatePath(`/panel/products/${productId}`);
  revalidatePath("/panel/my-sales");
  revalidatePath("/admin/returns");

  return { ok: true };
}
