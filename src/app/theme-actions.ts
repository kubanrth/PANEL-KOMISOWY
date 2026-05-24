"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isTheme, THEME_COOKIE, THEME_COOKIE_OPTIONS, type Theme } from "@/lib/theme";

/**
 * Persist the chosen theme. Called from <ThemeToggle/> after the client
 * does its optimistic DOM update. We revalidatePath('/') so RSC re-renders
 * pick up the new cookie on next navigation.
 */
export async function setTheme(theme: Theme): Promise<void> {
  if (!isTheme(theme)) return;
  const store = await cookies();
  store.set(THEME_COOKIE, theme, THEME_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}
