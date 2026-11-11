/**
 * Auth callback route handler.
 *
 * Supabase redirects here after email confirmation / password reset with a
 * `code` query param. The code is exchanged for a session, then the user is
 * sent to /onboarding when they have no workspace yet, or /dashboard when
 * they already belong to one. A `next` param (same-origin path only) is
 * honoured when present.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const nextParam = requestUrl.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : null;

  const loginWithError = (message: string) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  };

  if (errorParam) {
    return loginWithError(errorDescription ?? "invalid_link");
  }

  if (!code) {
    return loginWithError("missing_code");
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return loginWithError("invalid_link");
  }

  if (next) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // New users have no workspace yet → onboarding; existing users → dashboard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (!membershipError && memberships && memberships.length > 0) {
      return NextResponse.redirect(new URL("/dashboard/overview", request.url));
    }
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
