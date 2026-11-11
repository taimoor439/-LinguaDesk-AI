/**
 * Sending an agent reply by email.
 *
 * Used by the inbox reply flow (addConversationMessage) for
 * channel='email' conversations. The reply is ALWAYS saved to the
 * thread first by the caller; this helper only attempts the provider
 * send and reports whether it actually went out. On send failure —
 * or when no provider is connected — the caller keeps the saved
 * reply and reports "Saved to thread — not sent". Nothing here ever
 * claims a message was sent when it was not.
 *
 * Provider routing: the conversation stores which provider owns the
 * thread (conversations.provider, migration 0005). When that is
 * missing (a row created before 0005), the single connected account
 * is used if there is exactly one; with zero or two connected
 * accounts the send is refused rather than guessed.
 */

import { isEncryptionConfigured, ENCRYPTION_KEY_ERROR } from "./crypto";
import { sendGmailMessage, sendGraphMessage } from "./providers";
import type { EmailProvider } from "./config";
import type { EmailStore } from "./store";
import { refreshAccountAccessToken } from "./sync";

export interface SendReplyResult {
  sent: boolean;
  sentVia: EmailProvider | null;
  /** Provider message id when the provider returned one (proof of send). */
  providerMessageId: string | null;
  error: string | null;
}

export async function sendEmailReply(
  store: EmailStore,
  workspaceId: string,
  conversationId: string,
  body: string,
): Promise<SendReplyResult> {
  const notSent = (error: string): SendReplyResult => ({
    sent: false,
    sentVia: null,
    providerMessageId: null,
    error,
  });

  if (!isEncryptionConfigured()) return notSent(ENCRYPTION_KEY_ERROR);

  const context = await store.getReplyContext(workspaceId, conversationId);
  if (!context) return notSent("Conversation not found in this workspace.");
  if (context.conversation.channel !== "email") {
    return notSent("This conversation is not an email conversation.");
  }
  if (!context.contactEmail) {
    return notSent("The customer has no email address on file, so the reply cannot be sent.");
  }

  let provider = context.conversation.provider;
  if (!provider) {
    const accounts = (await store.getAccounts(workspaceId)).filter((a) => a.status === "connected");
    if (accounts.length === 1) {
      provider = accounts[0].provider;
    } else if (accounts.length === 0) {
      return notSent("No email account is connected, so the reply was saved to the thread but not sent.");
    } else {
      return notSent("This email thread does not record which provider owns it, and more than one account is connected — the reply was saved but not sent.");
    }
  }

  const account = await store.getAccount(workspaceId, provider);
  if (!account || account.status !== "connected") {
    return notSent(`No connected ${provider} account — the reply was saved to the thread but not sent.`);
  }

  const { accessToken, error: tokenError } = await refreshAccountAccessToken(store, workspaceId, account);
  if (tokenError || !accessToken) {
    return notSent(tokenError ?? "Could not get a usable access token.");
  }

  const subject = context.conversation.subject
    ? `Re: ${context.conversation.subject.replace(/^Re:\s*/i, "")}`
    : "Re: Your message";
  const threadId = context.conversation.provider_thread_id;

  // One retry after a forced refresh when the provider rejects the
  // token with 401 — the stored token may be dead before its expiry.
  const attemptSend = async (
    token: string,
  ): Promise<{ sent: boolean; providerMessageId: string | null; error: string | null }> => {
    if (provider === "gmail") {
      const { data, error } = await sendGmailMessage(token, {
        to: context.contactEmail as string,
        subject,
        body,
        threadId,
      });
      if (error || !data) return { sent: false, providerMessageId: null, error: error ?? "Gmail send failed." };
      return { sent: true, providerMessageId: data.providerMessageId || null, error: null };
    }
    const { data, error } = await sendGraphMessage(token, {
      to: context.contactEmail as string,
      subject,
      body,
      originalMessageId: context.latestCustomerProviderMessageId,
    });
    if (error || !data) return { sent: false, providerMessageId: null, error: error ?? "Microsoft send failed." };
    return { sent: true, providerMessageId: data.providerMessageId || null, error: null };
  };

  const first = await attemptSend(accessToken);
  if (first.sent) {
    return { sent: true, sentVia: provider, providerMessageId: first.providerMessageId, error: null };
  }
  if (first.error && first.error.includes("(401)")) {
    const refreshed = await refreshAccountAccessToken(store, workspaceId, account, { force: true });
    if (!refreshed.error && refreshed.accessToken) {
      const retry = await attemptSend(refreshed.accessToken);
      if (retry.sent) {
        return { sent: true, sentVia: provider, providerMessageId: retry.providerMessageId, error: null };
      }
      return notSent(retry.error ?? "Send failed after token refresh.");
    }
    return notSent(refreshed.error ?? "Send failed and the token could not be refreshed.");
  }
  return notSent(first.error ?? "Send failed.");
}
