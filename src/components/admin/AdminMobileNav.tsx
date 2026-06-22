"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Portal } from "@/components/ui/Portal";
import { signOut } from "@/app/panel/actions";
import type { Theme } from "@/lib/theme";

export type AdminMobileNavProps = {
  user: { email: string };
  profile: { first_name: string | null; last_name: string | null; role: "klient" | "admin" | "super_admin" };
  active: string;
  theme: Theme;
};

type NavGroup = {
  label: string;
  items: Array<{ key: string; label: string; href: string }>;
};

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Operacje",
    items: [
      { key: "queue", label: "Queue", href: "/admin" },
      { key: "crm", label: "CRM (master/detail)", href: "/admin/crm" },
      { key: "submissions", label: "Submissions", href: "/admin/submissions" },
      { key: "klienci", label: "Klienci", href: "/admin/klienci" },
      { key: "aqc", label: "A&QC", href: "/admin/aqc" },
      { key: "offers", label: "Offers (Zerr)", href: "/admin/offers" },
      { key: "returns", label: "Returns", href: "/admin/returns" },
      { key: "qr", label: "Generator QR", href: "/admin/qr" },
    ],
  },
  {
    label: "Workflow",
    items: [
      { key: "zapotrzebowanie", label: "Zapotrzebowanie", href: "/admin/zapotrzebowanie" },
      { key: "zmiany-ceny", label: "Zmiany ceny", href: "/admin/zmiany-ceny" },
    ],
  },
  {
    label: "Integracje",
    items: [
      { key: "integrations", label: "Fakturownia", href: "/admin/integrations/fakturownia" },
    ],
  },
  {
    label: "Finanse",
    items: [{ key: "payouts", label: "Wypłaty", href: "/admin/payouts" }],
  },
  {
    label: "Komunikacja",
    items: [
      { key: "inbox", label: "Inbox", href: "/admin/inbox" },
      { key: "stats", label: "Statystyki", href: "/admin/stats" },
      { key: "audit", label: "Audit log", href: "/admin/audit" },
    ],
  },
];

export function AdminMobileNav({ user, profile, active, theme }: AdminMobileNavProps) {
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <Logo showSuffix={false} />
            <span className="label text-purple">/admin</span>
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
        <div className="px-5 pt-5 pb-4 border-b border-border-soft flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo showSuffix={false} />
            <span className="label text-purple">/admin</span>
          </div>
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
          {ADMIN_NAV.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-6" : ""}>
              <div className="label">{group.label}</div>
              <ul className="mt-3 space-y-1.5 text-[14px]">
                {group.items.map((item) => {
                  const isActive = active === item.key;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`block py-2.5 px-3 -mx-3 rounded-[10px] transition-colors ${
                          isActive
                            ? "bg-purple/10 text-purple font-semibold"
                            : "text-text-soft hover:text-text hover:bg-surface"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="label mt-6">Powrót</div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            <li>
              <Link href="/panel" className="block py-2.5 px-3 -mx-3 rounded-[10px] text-text-soft hover:text-text hover:bg-surface">
                ↩ Panel klienta
              </Link>
            </li>
          </ul>
        </nav>

        <div className="px-5 py-4 border-t border-border-soft">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-purple/15 border border-purple/30 flex items-center justify-center font-semibold text-purple text-[12px]">
              {initials.toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate">{fullName}</div>
              <div className="text-[11px] text-text-mute truncate">{user.email}</div>
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
