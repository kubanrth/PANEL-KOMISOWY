"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Tray, Wallet, List, Plus, type IconProps } from "@phosphor-icons/react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Portal } from "@/components/ui/Portal";
import { signOut } from "@/app/panel/actions";
import { formatPLN } from "@/lib/format";
import {
  PANEL_SECTIONS, PANEL_BOTTOM, PANEL_TABS, normalizeActive, isItemActive,
  type NavBadges,
} from "./nav-config";
import { SidebarNav } from "./SidebarNav";
import type { Theme } from "@/lib/theme";

const TAB_ICONS: Record<string, ComponentType<IconProps>> = {
  SquaresFour, Tray, Wallet, List,
};

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
  badges?: NavBadges;
};

/**
 * Mobile nav klienta wg designu M1: top bar 56px (logo + theme + avatar),
 * bottom tab bar 68px (Przegląd / Oferty / [FAB Nowa oferta] / Portfel / Więcej),
 * „Więcej" otwiera pełnoekranowy sheet z kompletną nawigacją (SidebarNav).
 */
export function PanelMobileNav({
  user, profile, walletBalance, walletAvailable, active, theme, badges = {},
}: PanelMobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const activeKey = normalizeActive(active);

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials =
    (profile.first_name?.[0] ?? "") +
    (profile.last_name?.[0] ?? user.email[0]?.toUpperCase() ?? "");
  const resolvedBadges: NavBadges = { wallet: walletAvailable > 0, ...badges };

  // Aktywny tab: bezpośredni klucz albo parent aktywnego subitemu.
  const allItems = [...PANEL_SECTIONS, ...PANEL_BOTTOM].flatMap((s) => s.items);
  function tabActive(tabKey: string): boolean {
    if (tabKey === activeKey) return true;
    const item = allItems.find((i) => i.key === tabKey);
    return item ? isItemActive(item, activeKey) : false;
  }
  const anyTabActive = PANEL_TABS.some((t) => t.key !== "more" && tabActive(t.key));

  return (
    <>
      {/* Top bar */}
      <header className="lg:hidden sticky top-0 z-30 backdrop-blur-md bg-bg/85 border-b border-border-soft">
        <div className="px-4 h-[56px] flex items-center justify-between gap-3">
          <Logo showSuffix={false} />
          <div className="flex items-center gap-2">
            <ThemeToggle current={theme} />
            <div className="h-9 w-9 rounded-full bg-surface-2 border border-border flex items-center justify-center font-medium text-lime text-[11px]">
              {initials.toUpperCase().slice(0, 2)}
            </div>
          </div>
        </div>
      </header>

      {/* Bottom tab bar + FAB */}
      <Portal>
        <nav
          aria-label="Nawigacja dolna"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-md border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="h-[68px] grid grid-cols-5 items-center">
            {PANEL_TABS.slice(0, 2).map((t) => (
              <TabLink key={t.key} tab={t} active={tabActive(t.key)} />
            ))}

            {/* FAB — Nowa oferta */}
            <div className="flex justify-center">
              <Link
                href="/start"
                aria-label="Nowa oferta"
                className="h-14 w-14 -mt-7 rounded-full btn-primary !p-0 flex items-center justify-center"
              >
                <Plus size={22} weight="bold" />
              </Link>
            </div>

            <TabLink tab={PANEL_TABS[2]} active={tabActive(PANEL_TABS[2].key)} />
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="Więcej"
              aria-expanded={moreOpen}
              className={`flex flex-col items-center justify-center gap-1 h-full ${
                moreOpen || !anyTabActive ? "text-lime" : "text-text-mute"
              }`}
            >
              <List size={21} weight="regular" />
              <span className="text-[10px] font-medium">Więcej</span>
            </button>
          </div>
        </nav>

        {/* Sheet „Więcej" — pełna nawigacja */}
        <div
          onClick={() => setMoreOpen(false)}
          className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            moreOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden
        />
        <aside
          role="dialog"
          aria-label="Pełne menu"
          aria-hidden={!moreOpen}
          className={`lg:hidden fixed left-0 right-0 bottom-0 z-50 max-h-[85vh] bg-bg border-t border-border rounded-t-[24px] flex flex-col transition-transform duration-300 ease-out ${
            moreOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          {/* Drag handle + close */}
          <div className="flex-shrink-0 pt-3 pb-2 flex flex-col items-center">
            <div className="h-1 w-10 rounded-full bg-surface-3" aria-hidden />
          </div>
          <div className="px-4 pb-3 flex items-center justify-between border-b border-border-soft">
            <div className="text-[15px] font-medium">Menu</div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Zamknij menu"
              className="h-9 w-9 rounded-[10px] bg-surface-2 border border-border-soft text-text-mute hover:text-text inline-flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-3 py-4 flex-1 overflow-y-auto">
            <SidebarNav
              sections={PANEL_SECTIONS}
              activeKey={activeKey}
              badges={resolvedBadges}
              storageKey="kb-nav-panel"
              onNavigate={() => setMoreOpen(false)}
            />
            <div className="mt-6 pt-4 border-t border-border-soft">
              <SidebarNav
                sections={PANEL_BOTTOM}
                activeKey={activeKey}
                badges={resolvedBadges}
                storageKey="kb-nav-panel-bottom"
                onNavigate={() => setMoreOpen(false)}
              />
            </div>
          </div>

          {walletBalance > 0 && (
            <div className="px-4 py-3 border-t border-border-soft flex-shrink-0">
              <Link href="/panel/wallet" onClick={() => setMoreOpen(false)} className="block card-gradient-dark p-4 rounded-[16px]">
                <div className="label !text-mint/80">Portfel</div>
                <div className="mt-1 font-light text-[20px] tracking-[-0.02em] num text-mint">
                  {formatPLN(walletBalance, { decimals: false })}
                </div>
                <div className="mt-0.5 text-[11px] num text-text-soft">
                  Dostępne: {formatPLN(walletAvailable, { decimals: false })}
                </div>
              </Link>
            </div>
          )}

          <div
            className="px-4 py-3 border-t border-border-soft flex items-center gap-3 flex-shrink-0"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
          >
            <div className="h-9 w-9 rounded-full bg-surface-2 border border-border flex items-center justify-center font-medium text-lime text-[12px]">
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
              <button type="submit" className="text-text-mute hover:text-text p-1" title="Wyloguj" aria-label="Wyloguj">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        </aside>
      </Portal>
    </>
  );
}

function TabLink({
  tab, active,
}: {
  tab: (typeof PANEL_TABS)[number];
  active: boolean;
}) {
  const Icon = TAB_ICONS[tab.icon] ?? SquaresFour;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-1 h-full ${
        active ? "text-lime" : "text-text-mute"
      }`}
    >
      <Icon size={21} weight="regular" />
      <span className="text-[10px] font-medium">{tab.label}</span>
    </Link>
  );
}
