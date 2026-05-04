/**
 * Centralised env-var reader for Supabase.
 *
 * Supabase 2025 introduced new API key names:
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (replaces "anon" key)
 *
 * We accept either name (new + legacy) so existing deployments don't break.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** True when both URL and publishable key are present and URL looks valid. */
export const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("http") && SUPABASE_PUBLISHABLE_KEY.length > 0;
