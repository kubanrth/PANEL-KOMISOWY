"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/panel");

  if (!email || !password) {
    return { error: "Podaj e-mail i hasło." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

function mapAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Nieprawidłowy e-mail lub hasło.";
  if (/email not confirmed/i.test(msg)) return "Potwierdź e-mail (sprawdź skrzynkę).";
  return msg;
}
