/**
 * Server-only Supabase admin client (service_role key).
 *
 * Use sparingly and only on the server: it bypasses Row Level Security.
 * In Phase 2 it is used for one purpose only — reading the public
 * `profiles` rows (email / full name) of workspace members, so the team
 * list, assignment picker and message authors can be identified.
 * The `profiles` table's own RLS policy only lets a user see their own
 * row, so the anon client cannot list teammates' profiles.
 *
 * The caller MUST already have verified (via the anon client + RLS)
 * that the signed-in user is a member of the workspace, and the admin
 * client is only ever asked for profile rows of that workspace's
 * members. Returns null when the service-role key is not configured,
 * in which case callers fall back to showing the member's user id.
 *
 * Never import this module from a client component.
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

export function getAdminClient(): SupabaseClient | null {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) return null;
  if (serviceRoleKey.length < 20 || serviceRoleKey.toLowerCase().includes("your-")) {
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
