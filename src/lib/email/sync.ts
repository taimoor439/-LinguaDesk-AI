/**
 * Email sync — manual only in this phase (no background jobs).
 *
 * Flow: load the workspace's connected account → decrypt tokens →
 * refresh the access token when expired → fetch the 25 most recent
 * messages → for each: dedupe on provider message id, skip messages
 * sent by the connected account itself, find-or-create the contact,
 * find-or-create the conversation by provider thread id, insert the
 * customer message. Returns honest { imported, skipped } counts.
 *
 * Language comes from the Phase 4 heuristic detector (detectLanguage)
 * — the same better-than-blind guess the widget uses, never presented
 * as certain.
 */

import { decryptToken, encryptToken, isEncryptionConfigured, ENCRYPTION_KEY_ERROR } from "./crypto";
import {
  getGmailMessage,
  listGmailMessages,
  listGraphMessages,
  refreshAccessToken,
  type NormalizedEmail,
} from "./providers";
import { detectLanguage } from "@/lib/ai/detect";
import type { EmailProvider } from "./config";
import type { EmailAccountWithTokens, EmailStore } from "./store";

export interface SyncResult {
  imported: number;
  skipped: number;
  error: string | null;
}

export const MIGRATION_0005_ERROR =
  "Migration 0005 (email provider ids) has not been applied to this Supabase project yet — run supabase/migrations/0005_email_provider_ids.sql in the SQL Editor, then sync again.";

function isMissingColumnError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /provider_thread_id|provider_message_id|could not find the .* column|column .* does not exist/i.test(message);
}

/**
 * A usable access token for an account: the stored one while it is
 * still valid, otherwise a refreshed one (persisted, encrypted).
 * On refresh failure the account is marked 'error' and the honest
 * provider message is returned — sync/send must not silently keep
 * using a dead token.
 */
export async function refreshAccountAccessToken(
  store: EmailStore,
  workspaceId: string,
  account: EmailAccountWithTokens,
  opts?: { force?: boolean },
): Promise<{ accessToken: string | null; error: string | null }> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const stillValid = expiresAt > Date.now() + 60_000;
  if (stillValid && !opts?.force) {
    if (!account.access_token_encrypted) {
      return { accessToken: null, error: "The connected account has no stored access token. Reconnect it." };
    }
    const { data, error } = decryptToken(account.access_token_encrypted);
    if (error || !data) return { accessToken: null, error: error ?? "Could not decrypt the stored access token." };
    return { accessToken: data, error: null };
  }

  if (!account.refresh_token_encrypted) {
    await store.updateAccountStatus(account.id, workspaceId, "error");
    return { accessToken: null, error: "The access token expired and there is no refresh token stored. Reconnect the account." };
  }
  const { data: refreshToken, error: decryptError } = decryptToken(account.refresh_token_encrypted);
  if (decryptError || !refreshToken) {
    await store.updateAccountStatus(account.id, workspaceId, "error");
    return { accessToken: null, error: decryptError ?? "Could not decrypt the stored refresh token." };
  }
  const { data: tokens, error: refreshError } = await refreshAccessToken(account.provider, refreshToken);
  if (refreshError || !tokens) {
    await store.updateAccountStatus(account.id, workspaceId, "error");
    return { accessToken: null, error: refreshError ?? "Token refresh failed." };
  }
  const { data: encAccess, error: encError } = encryptToken(tokens.access_token);
  if (encError || !encAccess) {
    return { accessToken: null, error: encError ?? "Could not encrypt the refreshed token." };
  }
  let encRefresh: string | null = account.refresh_token_encrypted;
  if (tokens.refresh_token) {
    const enc = encryptToken(tokens.refresh_token);
    if (enc.data) encRefresh = enc.data;
  }
  const expiresAtIso = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;
  const persistError = await store.updateAccountTokens(
    account.id,
    workspaceId,
    encAccess,
    encRefresh,
    expiresAtIso,
  );
  if (persistError) {
    return { accessToken: null, error: `Token refreshed but could not be saved: ${persistError}` };
  }
  return { accessToken: tokens.access_token, error: null };
}

export async function syncEmailProvider(
  store: EmailStore,
  workspaceId: string,
  provider: EmailProvider,
): Promise<SyncResult> {
  if (!isEncryptionConfigured()) {
    return { imported: 0, skipped: 0, error: ENCRYPTION_KEY_ERROR };
  }
  const account = await store.getAccount(workspaceId, provider);
  if (!account) {
    return { imported: 0, skipped: 0, error: `No ${provider} account is connected for this workspace.` };
  }
  if (account.status !== "connected") {
    return { imported: 0, skipped: 0, error: `The ${provider} account is ${account.status}. Reconnect it before syncing.` };
  }
  if (!(await store.supportsProviderColumns(workspaceId))) {
    return { imported: 0, skipped: 0, error: MIGRATION_0005_ERROR };
  }

  const { accessToken, error: tokenError } = await refreshAccountAccessToken(store, workspaceId, account);
  if (tokenError || !accessToken) {
    return { imported: 0, skipped: 0, error: tokenError ?? "Could not get a usable access token." };
  }

  let emails: NormalizedEmail[] = [];
  let fetchError: string | null = null;
  const fetchAll = async (token: string): Promise<{ emails: NormalizedEmail[]; error: string | null }> => {
    if (provider === "gmail") {
      const { data: list, error: listError } = await listGmailMessages(token);
      if (listError || !list) return { emails: [], error: listError ?? "Could not list Gmail messages." };
      const out: NormalizedEmail[] = [];
      for (const item of list) {
        const { data: message, error: getError } = await getGmailMessage(token, item.id);
        if (getError || !message) continue;
        out.push(message);
      }
      return { emails: out, error: null };
    }
    const { data: list, error: listError } = await listGraphMessages(token);
    if (listError || !list) return { emails: [], error: listError ?? "Could not list Microsoft messages." };
    return { emails: list, error: null };
  };

  const first = await fetchAll(accessToken);
  emails = first.emails;
  fetchError = first.error;
  // A 401 means the stored token is dead even though it had not
  // expired on paper — refresh once and retry before giving up.
  if (fetchError && fetchError.includes("(401)")) {
    const refreshed = await refreshAccountAccessToken(store, workspaceId, account, { force: true });
    if (!refreshed.error && refreshed.accessToken) {
      const retry = await fetchAll(refreshed.accessToken);
      emails = retry.emails;
      fetchError = retry.error;
    } else if (refreshed.error) {
      fetchError = refreshed.error;
    }
  }
  if (fetchError) {
    return { imported: 0, skipped: 0, error: fetchError };
  }

  const ownEmail = (account.email ?? "").toLowerCase();
  let imported = 0;
  let skipped = 0;
  for (const email of emails) {
    if (!email.fromEmail) {
      skipped += 1;
      continue;
    }
    // Already imported (DB unique index is the backstop).
    if (await store.messageExists(workspaceId, email.providerMessageId)) {
      skipped += 1;
      continue;
    }
    // Never import mail the connected account sent itself.
    if (email.fromEmail.toLowerCase() === ownEmail) {
      skipped += 1;
      continue;
    }
    const body = email.body.trim();
    if (!body) {
      skipped += 1;
      continue;
    }
    const language = detectLanguage(`${email.subject ?? ""}\n${body}`);
    const { id: contactId, error: contactError } = await store.findOrCreateContact(
      workspaceId,
      email.fromEmail,
      email.fromName,
    );
    if (contactError || !contactId) {
      skipped += 1;
      continue;
    }
    let conversation = await store.findConversationByThreadId(workspaceId, provider, email.providerThreadId);
    if (!conversation) {
      const created = await store.createConversation(
        workspaceId,
        contactId,
        provider,
        email.providerThreadId,
        email.subject,
        language,
      );
      if (created.error || !created.id) {
        if (isMissingColumnError(created.error)) {
          return { imported, skipped, error: MIGRATION_0005_ERROR };
        }
        skipped += 1;
        continue;
      }
      conversation = {
        id: created.id,
        subject: email.subject,
        provider,
        provider_thread_id: email.providerThreadId,
      };
    }
    const inserted = await store.insertMessage(
      workspaceId,
      conversation.id,
      body,
      language,
      email.providerMessageId,
    );
    if (inserted.error || !inserted.id) {
      if (isMissingColumnError(inserted.error)) {
        return { imported, skipped, error: MIGRATION_0005_ERROR };
      }
      // Unique-index race: another sync already stored this message.
      skipped += 1;
      continue;
    }
    await store.touchConversation(workspaceId, conversation.id, new Date().toISOString());
    imported += 1;
  }

  await store.updateLastSync(account.id, workspaceId, new Date().toISOString());
  return { imported, skipped, error: null };
}
