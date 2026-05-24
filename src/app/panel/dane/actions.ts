"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Update klient's billing profile. Only updates fields that were actually
 * sent (so partial saves work). Account type stays read-only here — that's
 * decided at onboarding.
 */
export async function updateBillingProfile(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const patch: Record<string, string | null> = {};
  const fields = [
    "first_name",
    "last_name",
    "phone",
    "pesel_or_id",
    "company_name",
    "nip",
    "vat_id",
    "address_line",
    "postal_code",
    "city",
  ] as const;
  for (const f of fields) {
    const v = formData.get(f);
    if (v != null) {
      const s = String(v).trim();
      patch[f] = s || null;
    }
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/dane");
  return { ok: true };
}
