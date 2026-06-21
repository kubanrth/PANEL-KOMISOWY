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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Log szczegóły do Vercel logs żeby debugować w razie weird responses
      console.error("[loginAction] supabase auth error", {
        email,
        message: error.message,
        status: error.status,
        name: error.name,
      });
      return { error: mapAuthError(error.message) };
    }

    revalidatePath("/", "layout");
  } catch (e) {
    // Catch tylko błędy non-redirect (Next.js redirect throws NEXT_REDIRECT,
    // ale to dzieje się po try-block w `redirect(next)` poniżej — więc tu
    // łapiemy tylko prawdziwe wyjątki sieciowe / Supabase).
    console.error("[loginAction] unexpected", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Błąd techniczny: ${sanitize(msg)}` };
  }

  redirect(next);
}

function mapAuthError(msg: string | null | undefined): string {
  const clean = sanitize(msg);
  if (!clean) return "Nie można się zalogować. Sprawdź e-mail i hasło.";
  if (/invalid login credentials/i.test(clean)) return "Nieprawidłowy e-mail lub hasło.";
  if (/email not confirmed/i.test(clean)) {
    return "Konto niepotwierdzone. Wejdź w Supabase Dashboard → Authentication → Users → Confirm user.";
  }
  if (/too many|rate limit/i.test(clean)) return "Zbyt wiele prób. Poczekaj minutę i spróbuj ponownie.";
  if (/network|fetch/i.test(clean)) return "Problem z połączeniem do serwera. Odśwież i spróbuj ponownie.";
  return clean;
}

/**
 * Odrzucamy puste / placeholder error messages (np. "{}", "[object Object]",
 * "null") i zwracamy null żeby fallback friendly message zadziałał.
 */
function sanitize(msg: string | null | undefined): string {
  if (msg == null) return "";
  const trimmed = String(msg).trim();
  if (!trimmed) return "";
  if (/^[\{\[]\s*[\}\]]$/.test(trimmed)) return ""; // "{}", "[]"
  if (/^\[object [A-Za-z]+\]$/.test(trimmed)) return "";
  if (/^null$|^undefined$/i.test(trimmed)) return "";
  return trimmed;
}
