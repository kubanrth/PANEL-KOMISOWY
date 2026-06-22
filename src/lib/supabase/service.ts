import "server-only";

import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "./env";

/**
 * Service-role Supabase client. NEVER import this from a Client Component
 * — `import "server-only"` causes a Webpack build error if attempted.
 *
 * Used by webhooks (no user session) and admin background jobs that need
 * to bypass RLS deliberately. All access through this client is privileged
 * — wrap business logic in SECURITY DEFINER RPCs where possible so RLS
 * isn't just disabled but replaced with explicit validation.
 *
 * SUPABASE_SERVICE_ROLE_KEY is set in Vercel env vars (no NEXT_PUBLIC_).
 *
 * Uses `createServerClient` (same as user-session helper) with a no-op
 * cookie store — keeps return type identical to other clients in repo so
 * existing typed queries work without changes.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const SERVICE_CLIENT_CONFIGURED =
  SUPABASE_URL.startsWith("http") && SERVICE_ROLE_KEY.length > 0;

let cached: ReturnType<typeof createServerClient> | null = null;

export function getServiceClient() {
  if (!SERVICE_CLIENT_CONFIGURED) {
    throw new Error(
      "Service-role Supabase client not configured. Set SUPABASE_SERVICE_ROLE_KEY in env.",
    );
  }
  if (!cached) {
    cached = createServerClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          /* no-op — service client doesn't carry session cookies */
        },
      },
    });
  }
  return cached;
}
