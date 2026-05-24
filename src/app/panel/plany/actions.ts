"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Klient zgłasza plan sprzedaży — budżet marketingowy + opis pozycji które
 * planuje wysłać. Administrator dostaje notyfikację, może przygotować
 * priorytetowy slot A&QC.
 */
export async function submitSalesPlan(formData: FormData): Promise<Result> {
  const budgetRaw = String(formData.get("marketing_budget") || "");
  const itemsText = String(formData.get("planned_items") || "").trim();
  const expectedRaw = String(formData.get("expected_value") || "");

  const budget = budgetRaw
    ? Math.round(parseFloat(budgetRaw.replace(/[^\d.,]/g, "").replace(",", ".")) * 100)
    : 0;
  const expected = expectedRaw
    ? Math.round(parseFloat(expectedRaw.replace(/[^\d.,]/g, "").replace(",", ".")) * 100)
    : null;

  if (!itemsText && budget === 0 && !expected) {
    return { ok: false, error: "Wypełnij przynajmniej jedno pole." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const { error } = await supabase.from("sales_plans").insert({
    klient_id: user.id,
    marketing_budget_cents: budget,
    planned_items_text: itemsText || null,
    expected_value_cents: expected,
  });
  if (error) return { ok: false, error: error.message };

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "submission_signed", // re-use existing type — admin inbox aggregates
    title: "Plan sprzedaży zgłoszony",
    body: `Budżet marketingowy: ${(budget / 100).toFixed(0)} zł${expected ? ` · oczekiwana wartość: ${(expected / 100).toFixed(0)} zł` : ""}.`,
    payload: { budget_cents: budget, expected_value_cents: expected } as Record<string, unknown>,
  });

  revalidatePath("/panel/plany");
  return { ok: true };
}
