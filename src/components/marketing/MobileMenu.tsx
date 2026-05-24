"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { Portal } from "@/components/ui/Portal";
import type { Theme } from "@/lib/theme";

const LINKS = [
  { href: "#proces", label: "Jak to działa" },
  { href: "#aqc", label: "Authentication" },
  { href: "#wallet", label: "Wallet" },
  { href: "#stats", label: "Liczby" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingMobileMenu({ theme }: { theme: Theme }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
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

      <Portal>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-bg border-l border-border flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Menu nawigacyjne"
        aria-hidden={!open}
      >
        <div className="px-5 pt-5 pb-4 border-b border-border-soft flex items-center justify-between">
          <span className="label">Nawigacja</span>
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
          <ul className="space-y-1.5 text-[15px]">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 px-3 -mx-3 rounded-[10px] text-text-soft hover:text-text hover:bg-surface"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <hr className="my-6 border-border-soft" />

          <div className="space-y-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block py-3 px-3 -mx-3 rounded-[10px] text-text-soft hover:text-text hover:bg-surface text-[15px]"
            >
              Zaloguj się
            </Link>
            <ButtonLink href="/register" size="md" className="w-full">
              Sprzedaj z nami <ArrowRight />
            </ButtonLink>
          </div>
        </nav>

        <div className="px-5 py-4 border-t border-border-soft flex items-center justify-between">
          <span className="text-[12px] text-text-mute">Wygląd</span>
          <ThemeToggle current={theme} variant="labeled" />
        </div>
      </aside>
      </Portal>
    </>
  );
}
