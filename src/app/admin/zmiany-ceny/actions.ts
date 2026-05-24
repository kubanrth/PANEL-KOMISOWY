"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Admin akceptuje/odrzuca sugestię zmiany ceny. Akceptacja propaguje
 * listing_price_cents do products i pisze do audit_log + notyfikuje klienta.
 */
export async function decideAdminPriceChange(
  requestId: string,
  decision: "accepted" | "rejected",
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

  const { data: req } = await supabase
    .from("price_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.status !== "pending") return { ok: false, error: "Wniosek nie istnieje lub już zdecydowany." };

  const { error: updErr } = await supabase
    .from("price_change_requests")
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updErr) return { ok: false, error: updErr.message };

  if (decision === "accepted") {
    const { error: prodErr } = await supabase
      .from("products")
      .update({ listing_price_cents: req.suggested_price_cents })
      .eq("id", req.product_id);
    if (prodErr) return { ok: false, error: `Cena nie zaktualizowana: ${prodErr.message}` };
  }

  await supabase.from("notifications").insert({
    user_id: req.requested_by,
    type: "price_reduction_suggestion",
    title: decision === "accepted" ? "Cena zaakceptowana" : "Cena odrzucona",
    body:
      decision === "accepted"
        ? `Twoja sugestia (${(req.suggested_price_cents / 100).toFixed(0)} zł) została zatwierdzona — cena listingu zaktualizowana.`
        : "Twoja sugestia zmiany ceny została odrzucona przez administratora.",
    payload: { request_id: requestId, product_id: req.product_id } as Record<string, unknown>,
  });

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: `price_change_${decision}`,
    target_type: "product",
    target_id: req.product_id,
    payload: { request_id: requestId, suggested_price_cents: req.suggested_price_cents } as Record<string, unknown>,
  });

  revalidatePath("/admin/zmiany-ceny");
  revalidatePath("/panel/zmiany-ceny");
  revalidatePath("/panel/magazyn");
  return { ok: true };
}
