"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AQC_CHECKLIST } from "@/lib/types";
import type { AqcVerdict } from "@/lib/types";

export type SaveAqcInput = {
  productId: string;
  scores: Record<string, number>;
  verdict: AqcVerdict;
  notes: string;
  recommendedPriceCents: number;
};

export async function saveAqc(input: SaveAqcInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesja wygasła." };

  // Verify admin
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || !["admin", "super_admin"].includes(prof.role)) {
    return { ok: false, error: "Wymaga uprawnień administratora." };
  }

  // Validate scores
  for (const item of AQC_CHECKLIST) {
    const v = input.scores[item.key];
    if (typeof v !== "number" || v < 0 || v > 10) {
      return { ok: false, error: `Punkt ${item.label}: ocena musi być w zakresie 0-10.` };
    }
  }

  const scoreTotal = AQC_CHECKLIST.reduce((acc, item) => acc + (input.scores[item.key] || 0), 0);

  // Insert / update audit
  const { error: auditErr } = await supabase
    .from("aqc_audits")
    .upsert(
      {
        product_id: input.productId,
        inspector_id: user.id,
        scores: input.scores,
        score_total: scoreTotal,
        verdict: input.verdict,
        notes: input.notes || null,
        recommended_price_cents: input.recommendedPriceCents,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "product_id" },
    );
  if (auditErr) return { ok: false, error: auditErr.message };

  // Update product status + listing price
  const newStatus = input.verdict === "fail" ? "returned" : "listed";
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .update({
      status: newStatus,
      listing_price_cents: input.verdict === "fail" ? null : input.recommendedPriceCents,
    })
    .eq("id", input.productId)
    .select("submission_id, brand, model")
    .single();
  if (prodErr) return { ok: false, error: prodErr.message };

  // If FAIL — create return record
  if (input.verdict === "fail") {
    await supabase.from("returns").insert({
      product_id: input.productId,
      reason: "below_standards",
      fee_cents: 0,
      decision_deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      resolution: "pending",
      initiated_by: user.id,
      notes: input.notes,
    });
  }

  // If PASS — create listing
  if (input.verdict === "pass" || input.verdict === "warn") {
    await supabase.from("listings").insert({
      product_id: input.productId,
      channel: "kickback",
      current_price_cents: input.recommendedPriceCents,
    });

    // Push do Fakturownia (migracja 012). Best-effort: jeśli failuje,
    // pushProductToFakturownia automatycznie enqueueuje do fakturownia_push_queue
    // i admin może replay z /admin/integrations/fakturownia. NIE blokujemy
    // głównego flow A&QC.
    try {
      const { pushProductToFakturownia } = await import("@/lib/integrations/fakturownia/push");
      const result = await pushProductToFakturownia(input.productId);
      if (!result.ok) {
        console.warn("[saveAqc] Fakturownia push failed:", result.error.message);
      }
    } catch (e) {
      console.error("[saveAqc] Fakturownia push threw:", e);
    }
  }

  // Notify klient
  const { data: sub } = await supabase
    .from("submissions")
    .select("klient_id")
    .eq("id", prodData!.submission_id)
    .single();

  if (sub) {
    const titlePrefix = input.verdict === "pass" ? "A&QC PASS" : input.verdict === "warn" ? "A&QC WARN" : "A&QC FAIL — zwrot";
    await supabase.from("notifications").insert({
      user_id: sub.klient_id,
      type: input.verdict === "fail" ? "return_decision" : "valuation_ready",
      title: `${titlePrefix}: ${prodData!.brand} ${prodData!.model}`,
      body:
        input.verdict === "fail"
          ? "Audyt wykazał nieprawidłowości. Decyzja o zwrocie w panelu."
          : `Wycena rekomendowana: ${(input.recommendedPriceCents / 100).toFixed(0)} zł. Listing aktywny.`,
      ref_id: `PROD-${input.productId}`,
      payload: { score_total: scoreTotal, verdict: input.verdict, recommended_price_cents: input.recommendedPriceCents },
    });
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "aqc_complete",
    target_type: "product",
    target_id: input.productId,
    payload: { verdict: input.verdict, score_total: scoreTotal },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/aqc");
  revalidatePath(`/panel/products/${input.productId}`);

  return { ok: true };
}

export async function escalateAqc(productId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "aqc_escalate",
    target_type: "product",
    target_id: productId,
  });

  await supabase.from("products").update({ status: "aqc" }).eq("id", productId);
  revalidatePath("/admin/aqc");
  redirect("/admin/aqc");
}
