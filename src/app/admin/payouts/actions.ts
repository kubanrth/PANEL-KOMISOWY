"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function adminGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || !["admin", "super_admin"].includes(prof.role)) return null;
  return { supabase, user };
}

export async function authorizePayout(formData: FormData) {
  const ctx = await adminGuard();
  if (!ctx) return;
  const id = String(formData.get("payout_id") || "");
  if (!id) return;

  const { data: payout } = await ctx.supabase.from("payouts").select("*").eq("id", id).maybeSingle();
  if (!payout) return;

  if (payout.status === "requested") {
    // Authorize
    await ctx.supabase
      .from("payouts")
      .update({ status: "authorized", authorized_by: ctx.user.id, authorized_at: new Date().toISOString() })
      .eq("id", id);
  } else if (payout.status === "authorized") {
    // Mark done
    await ctx.supabase
      .from("payouts")
      .update({ status: "done", executed_at: new Date().toISOString(), bank_ref: `PRZ-${id.slice(0, 8).toUpperCase()}` })
      .eq("id", id);

    // Add wallet payout_done tx (-amount, but already debited at request — so this is just a marker)
    await ctx.supabase.from("wallet_transactions").insert({
      klient_id: payout.klient_id,
      type: "payout_done",
      amount_cents: 0,
      reference_id: `PAY-${id}`,
      description: "Wypłata zrealizowana na konto bankowe",
    });

    await ctx.supabase.from("notifications").insert({
      user_id: payout.klient_id,
      type: "payout_done",
      title: `Wypłata zrealizowana (${(payout.amount_cents / 100).toFixed(0)} zł)`,
      body: "Środki wpłynęły na Twoje konto bankowe.",
      ref_id: `PAY-${id}`,
    });
  }

  await ctx.supabase.from("audit_log").insert({
    actor_id: ctx.user.id,
    action: "payout_authorize",
    target_type: "payout",
    target_id: id,
  });

  revalidatePath("/admin/payouts");
  revalidatePath("/admin");
}

export async function rejectPayout(formData: FormData) {
  const ctx = await adminGuard();
  if (!ctx) return;
  const id = String(formData.get("payout_id") || "");
  if (!id) return;

  const { data: payout } = await ctx.supabase.from("payouts").select("*").eq("id", id).maybeSingle();
  if (!payout) return;

  await ctx.supabase.from("payouts").update({ status: "cancelled" }).eq("id", id);
  // Refund the locked amount
  await ctx.supabase.from("wallet_transactions").insert({
    klient_id: payout.klient_id,
    type: "payout_cancelled",
    amount_cents: payout.amount_cents,
    reference_id: `PAY-${id}`,
    description: "Wypłata odrzucona — zwrot do dostępnych środków",
  });

  await ctx.supabase.from("notifications").insert({
    user_id: payout.klient_id,
    type: "payout_failed",
    title: `Wypłata odrzucona (${(payout.amount_cents / 100).toFixed(0)} zł)`,
    body: "Środki wróciły do dostępnego salda.",
    ref_id: `PAY-${id}`,
  });

  await ctx.supabase.from("audit_log").insert({
    actor_id: ctx.user.id, action: "payout_reject", target_type: "payout", target_id: id,
  });

  revalidatePath("/admin/payouts");
}
