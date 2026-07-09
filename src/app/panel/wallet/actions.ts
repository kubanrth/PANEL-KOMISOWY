"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };


export async function requestPayout(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesja wygasła." };

  const amountCentsRaw = String(formData.get("amount_cents") || "0");
  const bankAccountId = String(formData.get("bank_account_id") || "");
  const amountCents = parseInt(amountCentsRaw, 10);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Podaj kwotę wypłaty." };
  }
  if (!bankAccountId) return { ok: false, error: "Wybierz konto bankowe." };

  const { error } = await supabase.rpc("request_payout", {
    amount_cents: amountCents,
    bank_account: bankAccountId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/wallet");
  return { ok: true };
}

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesja wygasła." };

  const submissionId = String(formData.get("submission_id") || "");
  const type = String(formData.get("type") || "");
  const fileUrl = String(formData.get("file_url") || "");

  if (!submissionId) return { ok: false, error: "Wybierz Submission." };
  if (!["umowa_ks", "faktura"].includes(type)) return { ok: false, error: "Wybierz typ dokumentu." };
  if (!fileUrl) return { ok: false, error: "Plik nie został wgrany." };

  // Sprawdź submission
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, klient_id, status")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub || sub.klient_id !== user.id) return { ok: false, error: "Submission niedostępna." };

  // Insert document
  const { error: docErr } = await supabase.from("documents").insert({
    klient_id: user.id,
    submission_id: submissionId,
    type,
    file_url: fileUrl,
    signed_at: new Date().toISOString(),
    signed_method: "manual_upload",
  });
  if (docErr) return { ok: false, error: docErr.message };

  // Mock: flip pending sales of this submission to unlocked
  // (Server-side dla bezpieczeństwa: znajdź pending tx, zmień na unlocked)
  const { data: pendingTxs } = await supabase
    .from("wallet_transactions")
    .select("id, amount_cents, reference_id")
    .eq("klient_id", user.id)
    .eq("type", "sale_pending");

  // Filter: tx whose reference_id corresponds to a product in this submission
  const { data: productsInSub } = await supabase
    .from("products")
    .select("id")
    .eq("submission_id", submissionId);

  const productIds = new Set((productsInSub ?? []).map((p) => `PROD-${p.id}`));
  const txsToUnlock = (pendingTxs ?? []).filter((tx) => productIds.has(tx.reference_id ?? ""));

  for (const tx of txsToUnlock) {
    // Insert offsetting unlocked tx (positive amount → moves into available)
    await supabase.from("wallet_transactions").insert([
      // Reverse the pending (negative)
      { klient_id: user.id, type: "manual_adjustment", amount_cents: -tx.amount_cents, reference_id: tx.reference_id, description: "Karencja: rozliczenie pending" },
      // Add as unlocked
      { klient_id: user.id, type: "sale_unlocked", amount_cents: tx.amount_cents, reference_id: tx.reference_id, description: "Środki odblokowane (Umowa K-S / FV)" },
    ]);

    // Notify
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "sale_unlocked",
      title: `Środki odblokowane (${tx.amount_cents / 100} zł)`,
      body: "Możesz wypłacić na konto bankowe lub zostawić w depozycie.",
      ref_id: tx.reference_id,
      payload: { amount_cents: tx.amount_cents },
    });
  }

  revalidatePath("/panel/wallet");
  revalidatePath("/panel/notifications");
  return { ok: true };
}
