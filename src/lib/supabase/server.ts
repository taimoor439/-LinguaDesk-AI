/**
 * Server-side Supabase client via @supabase/ssr (next/headers cookies).
 *
 * Never throws at import time and never crashes when env vars are missing:
 * `createClient()` falls back to a placeholder project whose calls fail
 * gracefully, and `getUser()` returns null on any error.
 */
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON_KEY = "placeholder-anon-key-not-configured";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseEnv();
  const supabaseUrl = isSupabaseConfigured() && url ? url : PLACEHOLDER_URL;
  const supabaseKey = isSupabaseConfigured() && anonKey ? anonKey : PLACEHOLDER_ANON_KEY;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // `cookies().set()` throws when called from a Server Component.
          // The middleware refreshes the session in that case, so it is
          // safe to ignore here (standard Supabase pattern).
        }
      },
    },
  });
}

/** Returns the currently signed-in user, or null when there is none / on any error. */
export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
}
