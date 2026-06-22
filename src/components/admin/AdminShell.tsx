import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { signOut } from "@/app/panel/actions";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AdminMobileNav } from "./AdminMobileNav";

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
    | "integrations";
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
  cta?: React.ReactNode;
};

export async function AdminShell({ user, profile, active, breadcrumb, children, cta }: AdminShellProps) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? user.email[0]?.toUpperCase());
  const theme = await getTheme();

  return (
    <div className="min-h-screen lg:flex">
      <AdminMobileNav user={user} profile={profile} active={active} theme={theme} />

      <aside className="hidden lg:flex flex-col w-[260px] xl:w-[280px] border-r border-border-soft bg-bg-soft/40 sticky top-0 h-screen">
        <div className="px-6 pt-6 pb-5 border-b border-border-soft flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <Logo showSuffix={false} />
              <span className="label text-purple">/admin</span>
            </div>
            <div className="text-[12px] text-text-mute mt-1.5">
              {profile.role === "super_admin" ? "Super-admin" : "Admin operacyjny"}
            </div>
          </div>
          <ThemeToggle current={theme} />
        </div>

        <nav className="px-6 py-6 flex-1 overflow-y-auto">
          <div className="label">Operacje</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <Item label="Queue" href="/admin" active={active === "queue"} />
            <Item label="CRM (master/detail)" href="/admin/crm" active={active === "crm"} />
            <Item label="Submissions" href="/admin/submissions" active={active === "submissions"} />
            <Item label="Klienci" href="/admin/klienci" active={active === "klienci"} />
            <Item label="A&QC" href="/admin/aqc" active={active === "aqc"} />
            <Item label="Offers (Zerr)" href="/admin/offers" active={active === "offers"} />
            <Item label="Returns" href="/admin/returns" active={active === "returns"} />
            <Item label="Generator QR" href="/admin/qr" active={active === "qr"} />
          </ul>

          <div className="label mt-9">Workflow</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <Item label="Zapotrzebowanie" href="/admin/zapotrzebowanie" active={active === "zapotrzebowanie"} />
            <Item label="Zmiany ceny" href="/admin/zmiany-ceny" active={active === "zmiany-ceny"} />
          </ul>

          <div className="label mt-9">Finanse</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <Item label="Wypłaty" href="/admin/payouts" active={active === "payouts"} />
          </ul>

          <div className="label mt-9">Integracje</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <Item label="Fakturownia" href="/admin/integrations/fakturownia" active={active === "integrations"} />
          </ul>

          <div className="label mt-9">Komunikacja</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <Item label="Inbox" href="/admin/inbox" active={active === "inbox"} />
            <Item label="Statystyki" href="/admin/stats" active={active === "stats"} />
            <Item label="Audit log" href="/admin/audit" active={active === "audit"} />
          </ul>

          <div className="label mt-9">Powrót</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <li><Link href="/panel" className="text-text-soft hover:text-text">↩ Panel klienta</Link></li>
          </ul>
        </nav>

        <div className="px-6 py-5 border-t border-border-soft">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-purple/15 border border-purple/30 flex items-center justify-center font-semibold text-purple text-[12px]">
              {initials.toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate">{fullName}</div>
              <div className="text-[11px] text-text-mute">{user.email}</div>
            </div>
            <form action={signOut}>
              <button type="submit" className="text-text-mute hover:text-text transition-colors p-1" title="Wyloguj">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

function Item({ label, href, active }: { label: string; href: string; active?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className={`block py-2 px-3 -mx-3 rounded-[10px] transition-colors ${
          active ? "bg-purple/10 text-purple font-semibold" : "text-text-soft hover:text-text hover:bg-surface"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
