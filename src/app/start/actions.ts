"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Photo, PricingMode } from "@/lib/types";

export type ProductInput = {
  brand: string;
  model: string;
  category?: string | null;
  size?: string | null;
  condition: number;
  description?: string | null;
  expected_price_cents: number;
  min_price_cents?: number | null;
  /** migration 007 */
  pricing_mode: PricingMode;
  /** required when pricing_mode === 'payout' */
  payout_price_cents?: number | null;
  photos?: Photo[];
};

export type CreateSubmissionInput = {
  products: ProductInput[];
};

export type CreateSubmissionResult =
  | { ok: true; submissionId: string }
  | { ok: false; error: string };

/**
 * Create a Submission (paczka) with products in one transaction.
 * Master Umowa Komisowa must already be signed — checked here against profile.
 * Returns the new SUB-XXXXX id; client redirects to /panel/submissions/{id}.
 */
export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<CreateSubmissionResult> {
  if (!input || !Array.isArray(input.products) || input.products.length === 0) {
    return { ok: false, error: "Dodaj co najmniej jeden produkt." };
  }
  for (const [i, p] of input.products.entries()) {
    if (!p.brand?.trim()) return { ok: false, error: `Produkt ${i + 1}: podaj markę.` };
    if (!p.model?.trim()) return { ok: false, error: `Produkt ${i + 1}: podaj model.` };
    if (!p.expected_price_cents || p.expected_price_cents <= 0) {
      return { ok: false, error: `Produkt ${i + 1}: podaj cenę.` };
    }
    if (p.condition == null || p.condition < 1 || p.condition > 10) {
      return { ok: false, error: `Produkt ${i + 1}: stan musi być z zakresu 1–10.` };
    }
    if (p.pricing_mode === "payout" && (!p.payout_price_cents || p.payout_price_cents <= 0)) {
      return { ok: false, error: `Produkt ${i + 1}: podaj kwotę wypłaty (tryb stała wypłata).` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };
  }

  // Master Umowa Komisowa gate — klient must have signed before sending any paczka.
  const { data: profile } = await supabase
    .from("profiles")
    .select("master_agreement_signed_at, master_agreement_signed_method")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.master_agreement_signed_at) {
    return { ok: false, error: "Podpisz najpierw Umowę Komisową (Panel → Umowa Komisowa)." };
  }

  // ---------- generate ID via Postgres SECURITY DEFINER function ----------
  const { data: idData, error: idError } = await supabase.rpc("generate_submission_id");
  if (idError || typeof idData !== "string") {
    return {
      ok: false,
      error: `Nie udało się wygenerować numeru Oferty: ${idError?.message ?? "unknown"}`,
    };
  }
  const submissionId = idData;

  // ---------- insert submission (paczka) ----------
  // Per-submission signed_at/method is kept for legacy schema compatibility;
  // semantically it now records the master agreement that was in force.
  const { error: subError } = await supabase.from("submissions").insert({
    id: submissionId,
    klient_id: user.id,
    status: "signed",
    signed_at: profile.master_agreement_signed_at,
    signed_method: profile.master_agreement_signed_method,
    created_by: user.id,
  });

  if (subError) {
    return { ok: false, error: `Nie udało się utworzyć Oferty: ${subError.message}` };
  }

  // ---------- insert products ----------
  const productsToInsert = input.products.map((p) => ({
    submission_id: submissionId,
    brand: p.brand.trim(),
    model: p.model.trim(),
    category: p.category?.trim() || null,
    size: p.size?.trim() || null,
    condition: p.condition,
    description: p.description?.trim() || null,
    expected_price_cents: p.expected_price_cents,
    min_price_cents: p.min_price_cents ?? null,
    pricing_mode: p.pricing_mode,
    payout_price_cents: p.pricing_mode === "payout" ? (p.payout_price_cents ?? null) : null,
    photos: p.photos ?? [],
    status: "draft" as const,
  }));

  const { error: prodError } = await supabase.from("products").insert(productsToInsert);

  if (prodError) {
    // Rollback the submission so we don't leave orphaned records.
    await supabase.from("submissions").delete().eq("id", submissionId);
    return { ok: false, error: `Nie udało się zapisać produktów: ${prodError.message}` };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/submissions");
  revalidatePath("/panel/inventory");

  return { ok: true, submissionId };
}

/**
 * Convenience wrapper that performs the action and redirects on success.
 * Used in client components where we want a Promise<never> on success.
 */
export async function createSubmissionAndRedirect(
  input: CreateSubmissionInput,
): Promise<CreateSubmissionResult | never> {
  const result = await createSubmission(input);
  if (result.ok) {
    redirect(`/panel/submissions/${result.submissionId}`);
  }
  return result;
}
