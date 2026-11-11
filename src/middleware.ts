/**
 * Next.js middleware.
 *
 * Only runs for /dashboard/* and /onboarding (see matcher below), so
 * public routes — /, /login, /signup, /forgot-password, /setup — are
 * never blocked here.
 *
 * - Supabase not configured: send /dashboard/* and /onboarding to /setup.
 * - Supabase configured: refresh the session, then send unauthenticated
 *   users to /login.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const response = await updateSession(request);

  // updateSession refreshes the session; check the (refreshed) session
  // from the request cookies to decide whether the user may proceed.
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Cookie writes are handled by updateSession; nothing to do here.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
