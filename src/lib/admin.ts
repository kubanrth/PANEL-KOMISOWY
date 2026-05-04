import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

/**
 * Server-side gate. Returns auth + admin profile or redirects.
 * Use at the top of every /admin/* page.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const role = (profile.role ?? "klient") as UserRole;
  if (role !== "admin" && role !== "super_admin") {
    redirect("/panel?reason=admin_required");
  }

  return {
    user: { id: user.id, email: user.email! },
    profile: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      role,
      account_type: profile.account_type,
    },
    supabase,
  };
}
