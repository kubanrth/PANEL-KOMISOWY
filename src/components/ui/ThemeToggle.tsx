"use client";

import { useTransition } from "react";
import { setTheme } from "@/app/theme-actions";
import type { Theme } from "@/lib/theme";

type Props = {
  current: Theme;
  /** "icon" = round button, "labeled" = pill with text. Default "icon". */
  variant?: "icon" | "labeled";
  className?: string;
};

export function ThemeToggle({ current, variant = "icon", className = "" }: Props) {
  const [isPending, startTransition] = useTransition();

  const flip = () => {
    const next: Theme = current === "dark" ? "light" : "dark";
    // Optimistic DOM update so users see the flip instantly — server action
    // persists the cookie + revalidates RSC tree behind the scenes.
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    }
    startTransition(() => {
      void setTheme(next);
    });
  };

  const isDark = current === "dark";
  const ariaLabel = isDark ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny";

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={flip}
        disabled={isPending}
        aria-label={ariaLabel}
        className={`pill pill-mute cursor-pointer hover:bg-surface-2 transition-colors ${className}`}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        {isDark ? "Tryb jasny" : "Tryb ciemny"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={isPending}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`h-9 w-9 rounded-[10px] border border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2 transition-colors inline-flex items-center justify-center ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
