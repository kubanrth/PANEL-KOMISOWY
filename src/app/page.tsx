import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";

/**
 * Root route — to NIE jest publiczny landing. `/` przekierowuje na panel
 * logowania albo bezpośrednio do panelu klienta jeśli sesja istnieje.
 *
 * Wszystko owinięte w try/catch z fallbackiem do /login — żeby crash na
 * profile lookup nie wywalał całego sajtu (widzieliśmy 500 na produkcji
 * gdy Daniel logował się jako admin bez pełnych pól w profiles).
 *
 * Stara marketingowa strona została przeniesiona do `/landing`.
 *
 * `force-dynamic` — strona zawsze renderuje się per-request (czyta cookies
 * via Supabase). Bez tego Next próbuje prerenderować przy build i logi
 * pokazują "Dynamic server usage" błąd, choć funkcjonalnie wszystko działa.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  let target = "/login";
  try {
    const supabase = await createClient();
    const user = await getSessionUser();

    if (user) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarded_at, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[/] profile lookup failed", error);
        // Profil nie istnieje albo RLS blokuje — wyloguj i wyślij do
        // logowania (zamiast crashować na .role).
        target = "/login";
      } else if (!profile?.onboarded_at) {
        target = "/onboarding";
      } else if (profile.role === "admin" || profile.role === "super_admin") {
        target = "/admin";
      } else {
        target = "/panel";
      }
    }
  } catch (e) {
    console.error("[/] root redirect error", e);
    target = "/login";
  }
  redirect(target);
}
