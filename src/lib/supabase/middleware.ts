/**
 * Supabase session refresh for Next.js middleware (standard @supabase/ssr
 * pattern). Refreshes the auth session from the request cookies and writes
 * any refreshed tokens back to the response.
 *
 * Returns the response to continue with. When Supabase is not configured
 * it simply passes the request through untouched.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const { url, anonKey } = getSupabaseEnv();
  // Guarded by isSupabaseConfigured() above, but keep TS happy.
  if (!url || !anonKey) return supabaseResponse;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshes the session if expired; a missing/invalid session is fine
  // here — route protection happens in src/middleware.ts.
  await supabase.auth.getUser();

  return supabaseResponse;
}
