import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (formerly middleware in Next.js < 16).
 * Refreshes Supabase auth cookies on every request and gates /panel /admin routes.
 *
 * Resilient mode: if Supabase env vars are missing/invalid, pass requests through
 * without auth gating. This lets the marketing landing render even before Supabase
 * is configured (e.g. on a fresh Vercel deploy with empty env vars).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase config → just pass through.
  if (!url || !anon || !url.startsWith("http")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anon, {
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
