"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function resolveReturn(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || !["admin", "super_admin"].includes(prof.role)) return;

  const id = String(formData.get("return_id") || "");
  const resolution = String(formData.get("resolution") || "");
  if (!id || !["pickup_paid", "disposal_free", "returned", "cancelled"].includes(resolution)) return;

  const { data: ret } = await supabase
    .from("returns")
    .select("product_id, fee_cents, products(submission_id, brand, model)")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("returns")
    .update({ resolution, resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (ret) {
    type RetProduct = { submission_id: string; brand: string; model: string };
    const productJoin = (ret as unknown as { products?: RetProduct | RetProduct[] | null }).products;
    const product = Array.isArray(productJoin) ? productJoin[0] : productJoin;

    // Mark product as returned
    await supabase.from("products").update({ status: "returned" }).eq("id", ret.product_id);

    // If pickup_paid — add wallet fee
    if (resolution === "pickup_paid" && ret.fee_cents > 0 && product) {
      const { data: sub } = await supabase
        .from("submissions").select("klient_id").eq("id", product.submission_id).maybeSingle();
      if (sub) {
        await supabase.from("wallet_transactions").insert({
          klient_id: sub.klient_id,
          type: "return_fee",
          amount_cents: -ret.fee_cents,
          reference_id: `PROD-${ret.product_id}`,
          description: `Opłata za wycofanie: ${product.brand} ${product.model}`,
        });
        await supabase.from("notifications").insert({
          user_id: sub.klient_id,
          type: "return_decision",
          title: `Zwrot rozwiązany: ${product.brand} ${product.model}`,
          body: `Resolution: odbiór z magazynu (opłata ${ret.fee_cents / 100} zł).`,
          ref_id: `PROD-${ret.product_id}`,
        });
      }
    }
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id, action: "return_resolve", target_type: "return", target_id: id, payload: { resolution },
  });

  revalidatePath("/admin/returns");
  revalidatePath("/admin");
}
