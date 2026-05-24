/**
 * Theme handling — cookie-driven, no-flash SSR.
 *
 * The cookie `kb_theme` carries `"dark" | "light"`. `app/layout.tsx` reads it
 * on every request and stamps `data-theme` on `<html>` before any CSS paints,
 * so users never see a flash of the wrong palette. The client toggle calls
 * the `setTheme` server action which flips the cookie + revalidates.
 */
import { cookies } from "next/headers";

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "kb_theme";

export function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light";
}

/** Reads the current theme on the server. Safe to call from any RSC. */
export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** Cookie options used everywhere we write the theme cookie. */
export const THEME_COOKIE_OPTIONS = {
  path: "/" as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax" as const,
  httpOnly: false, // we want JS to be able to read it for optimistic updates
};
