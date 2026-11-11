/**
 * Browser (client-side) Supabase client via @supabase/ssr.
 *
 * Never throws at import time: when Supabase is not configured, a client
 * pointed at a syntactically valid placeholder project is exported instead,
 * so auth calls fail gracefully (network/auth error) rather than crashing
 * the page. Pages must check `isSupabaseConfigured()` first and render
 * <SetupRequired /> when it is false, so this fallback is never used for
 * real work.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

export { isSupabaseConfigured } from "./env";

// Syntactically valid dummy project — only used when env vars are missing.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON_KEY = "placeholder-anon-key-not-configured";

function buildClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  if (isSupabaseConfigured() && url && anonKey) {
    return createBrowserClient(url, anonKey);
  }
  return createBrowserClient(PLACEHOLDER_URL, PLACEHOLDER_ANON_KEY);
}

export const supabase: SupabaseClient = buildClient();
