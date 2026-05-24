"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function changePassword(formData: FormData): Promise<Result> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) return { ok: false, error: "Hasło musi mieć co najmniej 8 znaków." };
  if (password !== confirm) return { ok: false, error: "Hasła nie są takie same." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/ustawienia");
  return { ok: true, message: "Hasło zmienione." };
}
