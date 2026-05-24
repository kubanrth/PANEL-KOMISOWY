"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Portal } from "@/components/ui/Portal";
import { signOut } from "@/app/panel/actions";
import { formatPLN } from "@/lib/format";
import { NAV_GROUPS, normalizeActive, type NavItem } from "./nav-config";
import type { Theme } from "@/lib/theme";

export type PanelMobileNavProps = {
  user: { email: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    account_type: "individual" | "business" | null;
  };
  walletBalance: number;
  walletAvailable: number;
  active: string | undefined;
  theme: Theme;
};

/**
 * Mobile top bar + slide-in drawer for /panel/*. Visible only under `lg`.
 *
 * Behavior:
 * - Top bar: hamburger left, Logo center, ThemeToggle right (sticky).
 * - Tap hamburger → drawer slides from left, backdrop fades in, body locks scroll.
 * - Tap link / backdrop / Escape → drawer closes.
 * - Route change auto-closes (usePathname watcher).
 */
export function PanelMobileNav({
  user, profile, walletBalance, walletAvailable, active, theme,
}: PanelMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeKey = normalizeActive(active);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock + ESC handler when drawer open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials =
    (profile.first_name?.[0] ?? "") +
    (profile.last_name?.[0] ?? user.email[0]?.toUpperCase() ?? "");

  return (
    <>
      {/* Mobile sticky top bar — visible under lg */}
      <header className="lg:hidden sticky top-0 z-30 backdrop-blur-md bg-bg/85 border-b border-border-soft">
        <div className="px-4 h-[56px] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Otwórz menu"
            className="h-9 w-9 rounded-[10px] border border-border bg-surface text-text-soft hover:text-text inline-flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <Logo showSuffix={false} className="flex-1 justify-center" />

          <ThemeToggle current={theme} />
        </div>
      </header>

      <Portal>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-bg border-r border-border flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-label="Menu nawigacyjne"
        aria-hidden={!open}
      >
        <div className="px-5 pt-5 pb-4 border-b border-border-soft flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Zamknij menu"
            className="h-9 w-9 rounded-[10px] text-text-mute hover:text-text inline-flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="px-5 py-5 flex-1 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-7" : ""}>
              <div className="label">{group.label}</div>
              <ul className="mt-3 space-y-1.5 text-[14px]">
                {group.items.map((item) => (
                  <DrawerLink
                    key={item.key}
                    item={item}
                    active={activeKey === item.key}
                    walletBalance={walletBalance}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {walletBalance > 0 && (
          <div className="px-5 py-4 border-t border-border-soft">
            <div className="card-gradient-blue p-4 rounded-[14px]">
              <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Wallet</div>
              <div className="mt-1 font-bold text-xl tracking-[-0.025em] text-white num">
                {formatPLN(walletBalance, { decimals: false })}
              </div>
              <div className="mt-0.5 text-white/70 text-[11px] num">
                Dostępne: {formatPLN(walletAvailable, { decimals: false })}
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-4 border-t border-border-soft">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue/15 border border-blue/30 flex items-center justify-center font-semibold text-blue text-[12px]">
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
              <button type="submit" className="text-text-mute hover:text-text p-1" title="Wyloguj">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>
      </Portal>
    </>
  );
}

function DrawerLink({
  item, active, walletBalance,
}: {
  item: NavItem;
  active: boolean;
  walletBalance: number;
}) {
  const baseCls = active
    ? "bg-blue/10 text-blue font-semibold"
    : "text-text-soft hover:text-text hover:bg-surface";

  let badgeValue: string | number | undefined;
  if (typeof item.badge === "string" || typeof item.badge === "number") {
    badgeValue = item.badge;
  } else if (item.key === "wallet" && walletBalance > 0) {
    badgeValue = formatPLN(walletBalance, { decimals: false });
  }
  const badgeColor =
    item.badgeAccent === "mint" ? "text-mint" : item.badgeAccent === "amber" ? "text-amber" : "text-text-mute";

  return (
    <li>
      <Link
        href={item.href}
        className={`flex items-center justify-between py-2.5 px-3 -mx-3 rounded-[10px] transition-colors ${baseCls}`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="truncate">{item.label}</span>
          {item.stub && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-text-faint border border-border rounded-full px-1.5 py-px">
              wkrótce
            </span>
          )}
        </span>
        {badgeValue != null && (
          <span className={`text-[11px] num ${active ? "text-blue" : badgeColor}`}>
            {badgeValue}
          </span>
        )}
      </Link>
    </li>
  );
}
