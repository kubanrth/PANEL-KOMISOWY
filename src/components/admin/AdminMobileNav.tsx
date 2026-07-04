"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Portal } from "@/components/ui/Portal";
import { signOut } from "@/app/panel/actions";
import { SidebarNav } from "@/components/panel/SidebarNav";
import { ADMIN_SECTIONS, type NavBadges } from "@/components/panel/nav-config";
import type { Theme } from "@/lib/theme";

export type AdminMobileNavProps = {
  user: { email: string };
  profile: { first_name: string | null; last_name: string | null; role: "klient" | "admin" | "super_admin" };
  theme: Theme;
  badges?: NavBadges;
};

/**
 * Mobile nav admina: top bar 56px (hamburger + logo z coral „Admin" pill)
 * + drawer z lewej z pełną nawigacją (SidebarNav, wspólna konfiguracja
 * z desktopowym sidebarem). Bez bottom tabs — back-office na mobile
 * to widok awaryjny, nie primary.
 */
export function AdminMobileNav({ user, profile, theme, badges }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials =
    (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? user.email[0]?.toUpperCase() ?? "");

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 backdrop-blur-md bg-bg/85 border-b border-border-soft">
        <div className="px-4 h-[56px] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Otwórz menu"
            className="h-9 w-9 rounded-[10px] border border-border bg-surface text-text-soft hover:text-text inline-flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <Logo showSuffix={false} />
            <span className="pill pill-coral !text-[10px] !px-2 !py-0.5">Admin</span>
          </div>

          <ThemeToggle current={theme} />
        </div>
      </header>

      <Portal>
      <div
        onClick={() => setOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-bg border-r border-border flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-label="Admin menu"
        aria-hidden={!open}
      >
        <div className="px-4 pt-5 pb-4 border-b border-border-soft bg-gradient-to-b from-coral/[.04] to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo showSuffix={false} />
            <span className="pill pill-coral !text-[10px] !px-2 !py-0.5">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Zamknij menu"
            className="h-9 w-9 rounded-[10px] text-text-mute hover:text-text inline-flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <SidebarNav
            sections={ADMIN_SECTIONS}
            badges={badges}
            storageKey="kb-nav-admin"
            onNavigate={() => setOpen(false)}
          />
          <div className="mt-6 pt-4 border-t border-border-soft">
            <Link
              href="/panel"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 h-11 pl-3.5 pr-3 rounded-[12px] text-[13.5px] text-text-soft hover:text-text hover:bg-surface-2/60 transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
              Panel klienta
            </Link>
          </div>
        </div>

        <div className="px-4 py-4 border-t border-border-soft">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-surface-2 border border-coral/30 flex items-center justify-center font-medium text-coral text-[12px]">
              {initials.toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate">{fullName}</div>
              <div className="text-[11px] text-text-mute truncate">{user.email}</div>
            </div>
            <form action={signOut}>
              <button type="submit" className="text-text-mute hover:text-text p-1" title="Wyloguj" aria-label="Wyloguj">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
