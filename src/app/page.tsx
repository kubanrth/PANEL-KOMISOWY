import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root route — to NIE jest publiczny landing. Tymczasowo (do czasu aż landing
 * stanie się produktowy) `/` przekierowuje na panel logowania albo bezpośrednio
 * do panelu klienta jeśli sesja istnieje.
 *
 * Stara marketingowa strona została przeniesiona do `/landing` (dostępna gdy
 * potrzeba, ale nie jest punktem wejścia).
 */
export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Logged in — sprawdź czy onboarding zrobiony
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) {
    redirect("/onboarding");
  }

  // Admin → /admin, klient → /panel
  if (profile.role === "admin" || profile.role === "super_admin") {
    redirect("/admin");
  }
  redirect("/panel");
}
