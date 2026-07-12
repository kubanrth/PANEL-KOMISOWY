import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { signOut } from "@/app/panel/actions";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AdminMobileNav } from "./AdminMobileNav";
import { SidebarNav } from "@/components/panel/SidebarNav";
import { TopbarBreadcrumb } from "@/components/panel/TopbarBreadcrumb";
import { ADMIN_SECTIONS } from "@/components/panel/nav-config";
import { requireAdmin } from "@/lib/admin";
import { getAdminBadges } from "@/lib/supabase/session";

/**
 * Chrome back-office — renderowany przez app/admin/layout.tsx.
 * Self-fetching: requireAdmin (cache() dedupe ze stronami) + liczniki kolejek.
 */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdmin();
  const [theme, resolvedBadges] = await Promise.all([getTheme(), getAdminBadges()]);

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? user.email[0]?.toUpperCase());

  return (
    <div className="min-h-screen lg:flex">
      <AdminMobileNav user={user} profile={profile} theme={theme} badges={resolvedBadges} />

      <aside className="hidden lg:flex flex-col w-[260px] border-r border-border bg-bg sticky top-0 h-screen">
        {/* Header z coral differentiator: jesteś w back-office */}
        <div className="px-4 pt-5 pb-4 border-b border-border-soft bg-gradient-to-b from-coral/[.04] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo showSuffix={false} />
              <span className="pill pill-coral !text-[10px] !px-2 !py-0.5">Admin</span>
            </div>
            <ThemeToggle current={theme} />
          </div>
          <div className="text-[11px] text-text-mute mt-1.5 px-0.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
            {profile.role === "super_admin" ? "Super-admin" : "Admin operacyjny"}
          </div>
        </div>

        {/* no-scrollbar: menu przewija się kółkiem, ale bez drugiego paska obok strony */}
        <div className="px-3 py-4 flex-1 overflow-y-auto no-scrollbar">
          <SidebarNav sections={ADMIN_SECTIONS} badges={resolvedBadges} storageKey="kb-nav-admin" />
        </div>

        {/* Bottom sticky group */}
        <div className="px-3 pt-3 pb-4 border-t border-border flex-shrink-0">
          <Link
            href="/panel"
            className="flex items-center gap-3 h-11 pl-3.5 pr-3 rounded-[12px] text-[13.5px] text-text-soft hover:text-text hover:bg-surface-2/60 transition-colors"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
            Panel klienta
          </Link>
          <div className="mt-3 px-1.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-surface-2 border border-coral/30 flex items-center justify-center font-medium text-coral text-[12px] flex-shrink-0">
              {initials.toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate">{fullName}</div>
              <div className="text-[11px] text-text-mute truncate">{user.email}</div>
            </div>
            <form action={signOut}>
              <button type="submit" className="text-text-mute hover:text-text transition-colors p-1" title="Wyloguj" aria-label="Wyloguj">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="hidden lg:flex sticky top-0 z-20 backdrop-blur-md bg-bg/80 border-b border-border-soft">
          <div className="w-full px-6 lg:px-10 h-[64px] flex items-center justify-between gap-4">
            <TopbarBreadcrumb admin />
            <div className="flex items-center gap-3">
              <span className="pill pill-mute">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Live ops
              </span>
            </div>
          </div>
        </header>


        <main className="px-4 py-5 pb-24 lg:px-10 lg:py-12 lg:pb-12">
          <Suspense fallback={<AdminSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}


function AdminSkeleton() {
  return (
    <div aria-busy="true" aria-label="Ładowanie">
      <div className="kb-skeleton h-3 w-40" />
      <div className="mt-4 kb-skeleton h-9 w-72" />
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kb-skeleton h-[120px] rounded-[20px]" />
        ))}
      </div>
      <div className="mt-8 kb-skeleton h-[320px] rounded-[20px]" />
    </div>
  );
}
