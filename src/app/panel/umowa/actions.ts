"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SignResult = { ok: true } | { ok: false; error: string };

export async function signMasterAgreement(method: "autopay" | "pz"): Promise<SignResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const { error } = await supabase
    .from("profiles")
    .update({
      master_agreement_signed_at: new Date().toISOString(),
      master_agreement_signed_method: method,
      master_agreement_version: "4.2",
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/panel/umowa");
  revalidatePath("/panel");
  return { ok: true };
}
