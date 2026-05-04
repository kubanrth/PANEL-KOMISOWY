import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { signOut } from "@/app/panel/actions";
import { formatPLN } from "@/lib/format";

export type PanelShellProps = {
  user: { email: string };
  profile: { first_name: string | null; last_name: string | null; account_type: "individual" | "business" | null };
  walletBalance?: number; // in cents
  walletAvailable?: number; // unlocked amount in cents
  active: "dashboard" | "submissions" | "wallet" | "notifications" | "stats" | "settings";
  pageTitle?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
  cta?: React.ReactNode;
};

export function PanelShell({
  user, profile, walletBalance = 0, walletAvailable = 0,
  active, pageTitle, breadcrumb, children, cta,
}: PanelShellProps) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? user.email[0]?.toUpperCase());

  return (
    <div className="min-h-screen flex">

      {/* SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-[260px] xl:w-[280px] border-r border-border-soft bg-bg-soft/40 sticky top-0 h-screen">
        <div className="px-6 pt-6 pb-5 border-b border-border-soft">
          <Logo />
        </div>

        <nav className="px-6 py-6 flex-1 overflow-y-auto">
          <div className="label">Sprzedaż</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <NavItem label="Panel" href="/panel" active={active === "dashboard"} />
            <NavItem label="Submissions" href="/panel/submissions" active={active === "submissions"} />
          </ul>

          <div className="label mt-9">Środki</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <NavItem label="Wallet" href="/panel/wallet" active={active === "wallet"} badge={walletBalance > 0 ? formatPLN(walletBalance, { decimals: false }) : undefined} badgeAccent />
          </ul>

          <div className="label mt-9">Konto</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <NavItem label="Powiadomienia" href="/panel/notifications" active={active === "notifications"} />
            <NavItem label="Statystyki" href="/panel/stats" active={active === "stats"} />
            <NavItem label="Ustawienia" href="/panel/settings" active={active === "settings"} />
          </ul>
        </nav>

        {/* Wallet quick widget */}
        {walletBalance > 0 && (
          <div className="px-6 py-5 border-t border-border-soft">
            <div className="card-gradient-blue p-5 rounded-[16px]">
              <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Wallet</div>
              <div className="mt-1 font-bold text-2xl tracking-[-0.035em] text-white num">
                {formatPLN(walletBalance, { decimals: false })}
              </div>
              <div className="mt-1 text-white/70 text-[11px] num">
                Dostępne: {formatPLN(walletAvailable, { decimals: false })}
              </div>
            </div>
          </div>
        )}

        {/* User pill */}
        <div className="px-6 py-5 border-t border-border-soft">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue/15 border border-blue/30 flex items-center justify-center font-semibold text-blue text-[12px]">
              {initials.toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate">{fullName}</div>
              <div className="text-[11px] text-text-mute">
                {profile.account_type === "individual" ? "Indywidualne" : profile.account_type === "business" ? "Biznesowe" : ""}
              </div>
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

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/80 border-b border-border-soft">
          <div className="px-6 lg:px-10 h-[64px] flex items-center justify-between gap-4">
            <Breadcrumb breadcrumb={breadcrumb} pageTitle={pageTitle} />
            <div className="flex items-center gap-3">
              {cta ?? (
                <ButtonLink href="/start" size="md">
                  Nowa Submission
                  <ArrowRight size={14} />
                </ButtonLink>
              )}
            </div>
          </div>
        </header>

        <main className="px-6 lg:px-10 py-8 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  label, href, active, badge, badgeAccent,
}: {
  label: string;
  href: string;
  active?: boolean;
  badge?: string;
  badgeAccent?: boolean;
}) {
  const cls = active
    ? "bg-blue/10 text-blue font-semibold"
    : "text-text-soft hover:text-text hover:bg-surface";
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center justify-between py-2 px-3 -mx-3 rounded-[10px] transition-colors ${cls}`}
      >
        <span>{label}</span>
        {badge && (
          <span className={`text-[11px] num ${active ? "text-blue" : badgeAccent ? "text-mint" : "text-text-mute"}`}>
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

function Breadcrumb({ breadcrumb, pageTitle }: { breadcrumb?: Array<{ label: string; href?: string }>; pageTitle?: string }) {
  if (!breadcrumb && !pageTitle) return null;
  return (
    <div className="flex items-center gap-2 text-[13px] text-text-soft">
      <Link href="/panel" className="hover:text-text">Panel</Link>
      {breadcrumb?.map((b, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="text-text-faint">/</span>
          {b.href ? (
            <Link href={b.href} className="hover:text-text">{b.label}</Link>
          ) : (
            <span className="text-text">{b.label}</span>
          )}
        </span>
      ))}
      {pageTitle && breadcrumb === undefined && (
        <>
          <span className="text-text-faint">/</span>
          <span className="text-text">{pageTitle}</span>
        </>
      )}
    </div>
  );
}
