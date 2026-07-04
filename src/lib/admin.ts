import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import type { UserRole } from "@/lib/types";

/**
 * Server-side gate. Returns auth + admin profile or redirects.
 * Use at the top of every /admin/* page.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");

  const profile = await getOwnProfile();

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
});
