import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { signOut } from "@/app/panel/actions";
import { formatPLN } from "@/lib/format";
import { PANEL_SECTIONS, PANEL_BOTTOM, type NavBadges } from "./nav-config";
import { SidebarNav } from "./SidebarNav";
import type { Theme } from "@/lib/theme";

export type PanelSidebarProps = {
  user: { email: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    account_type: "individual" | "business" | null;
  };
  walletBalance: number;
  walletAvailable: number;
  theme: Theme;
  badges?: NavBadges;
};

export function PanelSidebar({
  user,
  profile,
  walletBalance,
  walletAvailable,
  theme,
  badges = {},
}: PanelSidebarProps) {
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials =
    (profile.first_name?.[0] ?? "") +
    (profile.last_name?.[0] ?? user.email[0]?.toUpperCase() ?? "");

  // Kropka na Portfelu gdy są środki do wypłaty.
  const resolvedBadges: NavBadges = { wallet: walletAvailable > 0, ...badges };

  return (
    <aside className="hidden lg:flex flex-col w-[260px] border-r border-border bg-bg sticky top-0 h-screen">
      {/* Header: logo + theme toggle */}
      <div className="px-4 pt-5 pb-4 border-b border-border-soft">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle current={theme} />
        </div>
        <div className="text-[11px] text-text-mute mt-1.5 px-0.5">Panel komisanta</div>
      </div>

      <div className="px-3 py-4 flex-1 overflow-y-auto">
        <SidebarNav sections={PANEL_SECTIONS} badges={resolvedBadges} storageKey="kb-nav-panel" />
      </div>

      {/* Bottom sticky group */}
      <div className="px-3 pt-3 pb-4 border-t border-border flex-shrink-0">
        <SidebarNav sections={PANEL_BOTTOM} badges={resolvedBadges} storageKey="kb-nav-panel-bottom" />

        {/* Wallet quick balance (gdy są środki) */}
        {walletBalance > 0 && (
          <Link
            href="/panel/wallet"
            className="mt-3 block card-gradient-dark p-4 rounded-[16px] hover:opacity-95 transition-opacity"
          >
            <div className="label !text-mint/80">Portfel</div>
            <div className="mt-1 font-light text-[22px] tracking-[-0.02em] num text-mint">
              {formatPLN(walletBalance, { decimals: false })}
            </div>
            <div className="mt-0.5 text-[11px] num text-text-soft">
              Dostępne: {formatPLN(walletAvailable, { decimals: false })}
            </div>
          </Link>
        )}

        {/* User */}
        <div className="mt-3 px-1.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-surface-2 border border-border flex items-center justify-center font-medium text-lime text-[12px] flex-shrink-0">
            {initials.toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] truncate">{fullName}</div>
            <div className="text-[11px] text-text-mute">
              {profile.account_type === "individual"
                ? "Indywidualne"
                : profile.account_type === "business"
                  ? "Biznesowe"
                  : ""}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-text-mute hover:text-text transition-colors p-1"
              title="Wyloguj"
              aria-label="Wyloguj"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
