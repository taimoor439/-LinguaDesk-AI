"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace, type ActionResult } from "@/lib/actions";
import {
  buildAuthorizeUrl,
  getProviderEnvStatus,
  OAUTH_STATE_COOKIE,
  PROVIDER_LABELS,
  type EmailProvider,
} from "@/lib/email/config";
import { isEncryptionConfigured, ENCRYPTION_KEY_ERROR } from "@/lib/email/crypto";
import { SupabaseEmailStore } from "@/lib/email/store";
import { syncEmailProvider, type SyncResult } from "@/lib/email/sync";

/**
 * Phase 5 server actions (Email — Gmail + Microsoft Graph OAuth).
 *
 * Every action:
 * - verifies workspace membership via requireWorkspace() before
 *   touching the database,
 * - never throws — failures are returned as `{ error }`,
 * - refuses honestly when the OAuth client or the encryption key is
 *   missing (no tokens are ever stored unencrypted, no connect URL
 *   is ever built for an unconfigured provider),
 * - never calls a live provider API directly: the connect action only
 *   builds the provider authorize URL, the callback route exchanges
 *   the code, and sync goes through src/lib/email/sync.ts.
 */

function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ActionResult<T> {
  return { data: null, error };
}

function isProvider(value: string): value is EmailProvider {
  return value === "gmail" || value === "microsoft";
}

export interface ConnectResult {
  authorizeUrl: string;
}

/**
 * Start the OAuth connect flow for a provider. Returns the provider
 * authorize URL; the client component redirects the browser to it.
 * The CSRF nonce lives in an httpOnly cookie and the workspace id +
 * provider are encoded in the `state` value the callback verifies.
 */
export async function startEmailConnect(provider: string): Promise<ActionResult<ConnectResult>> {
  if (!isProvider(provider)) return fail("Unknown email provider.");
  const envStatus = getProviderEnvStatus(provider);
  if (!envStatus.configured) {
    return fail(
      `${PROVIDER_LABELS[provider]} is not configured — set ${envStatus.missing.join(" and ")} in .env.local first.`,
    );
  }
  if (!isEncryptionConfigured()) return fail(ENCRYPTION_KEY_ERROR);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const nonce = randomUUID();
  const state = Buffer.from(
    JSON.stringify({ w: context.workspaceId, p: provider, n: nonce }),
    "utf8",
  ).toString("base64url");
  const authorizeUrl = buildAuthorizeUrl(provider, state);
  if (!authorizeUrl) {
    return fail(`${PROVIDER_LABELS[provider]} is not configured.`);
  }

  cookies().set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/email/callback",
    maxAge: 600,
  });

  return ok({ authorizeUrl });
}

/** Disconnect a provider: clears the stored tokens, status 'disconnected'. */
export async function disconnectEmailAccount(provider: string): Promise<ActionResult> {
  if (!isProvider(provider)) return fail("Unknown email provider.");
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const store = new SupabaseEmailStore(supabase);
  const account = await store.getAccount(context.workspaceId, provider);
  if (!account) return fail(`No ${provider} account is connected for this workspace.`);
  const clearError = await store.clearAccountTokens(account.id, context.workspaceId);
  if (clearError) return fail(clearError);

  revalidatePath("/dashboard/email");
  return ok(null);
}

/**
 * Manual sync for one provider. Returns honest { imported, skipped }
 * counts; a failed sync returns the error and imports nothing new
 * beyond what already succeeded in that run.
 */
export async function syncEmailAccount(provider: string): Promise<ActionResult<SyncResult>> {
  if (!isProvider(provider)) return fail("Unknown email provider.");
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const store = new SupabaseEmailStore(supabase);
  const result = await syncEmailProvider(store, context.workspaceId, provider);
  if (result.error) return fail(result.error);

  revalidatePath("/dashboard/email");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/overview");
  return ok(result);
}
