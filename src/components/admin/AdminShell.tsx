import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { signOut } from "@/app/panel/actions";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AdminMobileNav } from "./AdminMobileNav";
import { SidebarNav } from "@/components/panel/SidebarNav";
import { ADMIN_SECTIONS, type NavBadges } from "@/components/panel/nav-config";

export type AdminShellProps = {
  user: { email: string };
  profile: { first_name: string | null; last_name: string | null; role: "klient" | "admin" | "super_admin" };
  active:
    | "queue"
    | "submissions"
    | "klienci"
    | "crm"
    | "aqc"
    | "offers"
    | "returns"
    | "qr"
    | "payouts"
    | "inbox"
    | "stats"
    | "audit"
    | "zapotrzebowanie"
    | "zmiany-ceny"
    | "co-warto-dodac"
    | "integrations";
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
  cta?: React.ReactNode;
  badges?: NavBadges;
};

export async function AdminShell({ user, profile, active, breadcrumb, children, cta, badges }: AdminShellProps) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? user.email[0]?.toUpperCase());
  const theme = await getTheme();

  return (
    <div className="min-h-screen lg:flex">
      <AdminMobileNav user={user} profile={profile} active={active} theme={theme} />

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

        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <SidebarNav sections={ADMIN_SECTIONS} activeKey={active} badges={badges} storageKey="kb-nav-admin" />
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
            <div className="flex items-center gap-2 text-[13px] text-text-soft">
              <Link href="/admin" className="hover:text-text">Admin</Link>
              {breadcrumb?.map((b, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="text-text-faint">/</span>
                  {b.href ? <Link href={b.href} className="hover:text-text">{b.label}</Link> : <span className="text-text">{b.label}</span>}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {cta ?? (
                <span className="pill pill-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                  Live ops
                </span>
              )}
            </div>
          </div>
        </header>

        {breadcrumb && breadcrumb.length > 0 && (
          <div className="lg:hidden px-4 py-3 border-b border-border-soft">
            <div className="flex items-center gap-2 text-[12px] text-text-soft overflow-x-auto no-scrollbar">
              <Link href="/admin" className="hover:text-text whitespace-nowrap">Admin</Link>
              {breadcrumb.map((b, i) => (
                <span key={i} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-text-faint">/</span>
                  {b.href ? (
                    <Link href={b.href} className="hover:text-text">{b.label}</Link>
                  ) : (
                    <span className="text-text">{b.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <main className="px-4 py-5 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
