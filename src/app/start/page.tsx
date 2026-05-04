import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Wymaga zalogowania
  if (!user) redirect("/register?next=/start");

  // Sprawdź onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect("/onboarding");

  // Submission flow trafi tu w Sesji 2 — póki co przekieruj na panel
  redirect("/panel");
}
