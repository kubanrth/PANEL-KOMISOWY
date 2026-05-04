"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Photo } from "@/lib/types";

export type ProductInput = {
  brand: string;
  model: string;
  category?: string | null;
  size?: string | null;
  condition: number;
  description?: string | null;
  expected_price_cents: number;
  min_price_cents?: number | null;
  photos?: Photo[];
};

export type CreateSubmissionInput = {
  signed_method: "autopay" | "pz";
  products: ProductInput[];
};

export type CreateSubmissionResult =
  | { ok: true; submissionId: string }
  | { ok: false; error: string };

/**
 * Create a Submission with products in one transaction.
 * Returns the new SUB-XXXXX id; client redirects to /panel/submissions/{id}.
 */
export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<CreateSubmissionResult> {
  // ---------- validate ----------
  if (!input || !Array.isArray(input.products) || input.products.length === 0) {
    return { ok: false, error: "Dodaj co najmniej jeden produkt." };
  }
  if (!["autopay", "pz"].includes(input.signed_method)) {
    return { ok: false, error: "Wybierz metodę podpisu (Autopay lub Profil zaufany)." };
  }
  for (const [i, p] of input.products.entries()) {
    if (!p.brand?.trim()) return { ok: false, error: `Produkt ${i + 1}: podaj markę.` };
    if (!p.model?.trim()) return { ok: false, error: `Produkt ${i + 1}: podaj model.` };
    if (!p.expected_price_cents || p.expected_price_cents <= 0) {
      return { ok: false, error: `Produkt ${i + 1}: podaj cenę oczekiwaną.` };
    }
    if (p.condition == null || p.condition < 1 || p.condition > 10) {
      return { ok: false, error: `Produkt ${i + 1}: stan musi być z zakresu 1–10.` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };
  }

  // ---------- generate ID via Postgres SECURITY DEFINER function ----------
  const { data: idData, error: idError } = await supabase.rpc("generate_submission_id");
  if (idError || typeof idData !== "string") {
    return {
      ok: false,
      error: `Nie udało się wygenerować numeru Submission: ${idError?.message ?? "unknown"}`,
    };
  }
  const submissionId = idData;

  // ---------- insert submission ----------
  const { error: subError } = await supabase.from("submissions").insert({
    id: submissionId,
    klient_id: user.id,
    status: "signed",
    signed_at: new Date().toISOString(),
    signed_method: input.signed_method,
    created_by: user.id,
  });

  if (subError) {
    return { ok: false, error: `Nie udało się zapisać umowy: ${subError.message}` };
  }

  // ---------- insert products (with naive rollback on failure) ----------
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
