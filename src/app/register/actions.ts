"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string } | undefined;

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("password_confirm") || "");

  if (!email || !password) return { error: "Podaj e-mail i hasło." };
  if (password.length < 8) return { error: "Hasło musi mieć minimum 8 znaków." };
  if (password !== passwordConfirm) return { error: "Hasła nie są identyczne." };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"}/auth/callback`,
    },
  });

  if (error) {
    if (/already registered/i.test(error.message)) {
      return { error: "Konto z tym e-mailem już istnieje. Zaloguj się." };
    }
    return { error: error.message };
  }

  // If email confirmation is disabled in Supabase, session is returned immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  return { success: `Wysłaliśmy link aktywacyjny na ${email}. Otwórz wiadomość, by potwierdzić rejestrację.` };
}
