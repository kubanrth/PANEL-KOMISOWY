import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_CONFIGURED } from "@/lib/supabase/env";

/**
 * Proxy (formerly middleware in Next.js < 16).
 * Refreshes Supabase auth cookies on every request and gates /panel /admin /start routes.
 *
 * Resilient: if Supabase env vars are missing/invalid, pass requests through
 * without auth gating so the marketing landing renders even before Supabase
 * is configured.
 */
export async function proxy(request: NextRequest) {
  // Webhook endpoints nie mają user-session i mają własną auth (HMAC).
  // Skip proxy żeby nie robić niepotrzebnego Supabase cookie refresh
  // (~80-200ms latency + ryzyko side-effectów na cookies).
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next({ request });
  }

  if (!SUPABASE_CONFIGURED) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isProtected =
      path.startsWith("/panel") || path.startsWith("/admin") || path.startsWith("/start");
    const isAuthPage = path === "/login" || path === "/register";

    if (isProtected && !user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthPage && user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/panel";
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (e) {
    // Supabase unreachable / invalid creds → don't blow up. Log and pass through.
    console.error("[proxy] Supabase auth check failed, passing through:", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
