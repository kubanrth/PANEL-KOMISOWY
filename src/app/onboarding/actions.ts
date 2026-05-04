"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string } | undefined;

export async function saveOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const accountType = String(formData.get("account_type") || "");
  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const peselOrId = String(formData.get("pesel_or_id") || "").trim();
  const company = String(formData.get("company") || "").trim();
  const nip = String(formData.get("nip") || "").trim();

  if (!["individual", "business"].includes(accountType)) {
    return { error: "Wybierz typ konta." };
  }
  if (!firstName || !lastName) {
    return { error: "Podaj imię i nazwisko." };
  }
  if (accountType === "individual" && !peselOrId) {
    return { error: "Podaj PESEL lub numer dowodu." };
  }
  if (accountType === "business" && (!company || !nip)) {
    return { error: "Podaj nazwę firmy i NIP." };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      account_type: accountType,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      pesel_or_id: accountType === "individual" ? peselOrId : null,
      company_name: accountType === "business" ? company : null,
      nip: accountType === "business" ? nip : null,
      onboarded_at: new Date().toISOString(),
    });

  if (error) {
    return { error: `Nie udało się zapisać profilu: ${error.message}` };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}
