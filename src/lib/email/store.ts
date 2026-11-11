/**
 * Email persistence — the seam between the provider/sync/send logic
 * and Supabase.
 *
 * `EmailStore` is a plain interface so the sync/send code can be
 * exercised in tests with an in-memory store while production uses
 * `SupabaseEmailStore` (anon client + RLS, like the rest of the app —
 * the member policies on email_accounts / conversations / messages /
 * contacts already scope every query to the caller's workspace).
 *
 * Token columns are ONLY ever read through `getAccount()` here, and
 * only after the caller has proven workspace membership via
 * requireWorkspace(). The dashboard list query in db.ts deliberately
 * selects no token columns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailProvider } from "./config";

export interface EmailAccountWithTokens {
  id: string;
  workspace_id: string;
  provider: EmailProvider;
  email: string | null;
  status: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  last_sync_at: string | null;
}

export interface ConversationRef {
  id: string;
  subject: string | null;
  provider: EmailProvider | null;
  provider_thread_id: string | null;
}

export interface ReplyContext {
  conversation: {
    id: string;
    channel: string;
    subject: string | null;
    provider: EmailProvider | null;
    provider_thread_id: string | null;
  };
  /** Email address of the customer contact, or null when unknown. */
  contactEmail: string | null;
  /** Provider id of the latest customer message, for Graph replies. */
  latestCustomerProviderMessageId: string | null;
}

export interface EmailStore {
  getAccount(workspaceId: string, provider: EmailProvider): Promise<EmailAccountWithTokens | null>;
  getAccounts(workspaceId: string): Promise<EmailAccountWithTokens[]>;
  upsertAccount(
    workspaceId: string,
    provider: EmailProvider,
    email: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string | null,
    tokenExpiresAt: string | null,
  ): Promise<string | null>;
  updateAccountTokens(
    accountId: string,
    workspaceId: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string | null,
    tokenExpiresAt: string | null,
  ): Promise<string | null>;
  updateAccountStatus(accountId: string, workspaceId: string, status: string): Promise<string | null>;
  updateLastSync(accountId: string, workspaceId: string, at: string): Promise<string | null>;
  clearAccountTokens(accountId: string, workspaceId: string): Promise<string | null>;
  /** True when the 0005 provider-id columns exist on conversations/messages. */
  supportsProviderColumns(workspaceId: string): Promise<boolean>;
  messageExists(workspaceId: string, providerMessageId: string): Promise<boolean>;
  findConversationByThreadId(
    workspaceId: string,
    provider: EmailProvider,
    providerThreadId: string,
  ): Promise<ConversationRef | null>;
  createConversation(
    workspaceId: string,
    contactId: string | null,
    provider: EmailProvider,
    providerThreadId: string,
    subject: string | null,
    language: string,
  ): Promise<{ id: string | null; error: string | null }>;
  findOrCreateContact(
    workspaceId: string,
    email: string,
    name: string | null,
  ): Promise<{ id: string | null; error: string | null }>;
  insertMessage(
    workspaceId: string,
    conversationId: string,
    body: string,
    language: string,
    providerMessageId: string,
  ): Promise<{ id: string | null; error: string | null }>;
  touchConversation(workspaceId: string, conversationId: string, at: string): Promise<void>;
  getReplyContext(workspaceId: string, conversationId: string): Promise<ReplyContext | null>;
  updateMessageProviderId(
    messageId: string,
    workspaceId: string,
    providerMessageId: string,
  ): Promise<string | null>;
}

function asAccount(row: unknown): EmailAccountWithTokens | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.workspace_id !== "string") return null;
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    provider: (r.provider as EmailProvider) ?? "gmail",
    email: typeof r.email === "string" ? r.email : null,
    status: typeof r.status === "string" ? r.status : "disconnected",
    access_token_encrypted: typeof r.access_token_encrypted === "string" ? r.access_token_encrypted : null,
    refresh_token_encrypted: typeof r.refresh_token_encrypted === "string" ? r.refresh_token_encrypted : null,
    token_expires_at: typeof r.token_expires_at === "string" ? r.token_expires_at : null,
    last_sync_at: typeof r.last_sync_at === "string" ? r.last_sync_at : null,
  };
}

const ACCOUNT_COLUMNS =
  "id, workspace_id, provider, email, status, access_token_encrypted, refresh_token_encrypted, token_expires_at, last_sync_at";

export class SupabaseEmailStore implements EmailStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAccount(workspaceId: string, provider: EmailProvider): Promise<EmailAccountWithTokens | null> {
    const { data, error } = await this.supabase
      .from("email_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return asAccount(data);
  }

  async getAccounts(workspaceId: string): Promise<EmailAccountWithTokens[]> {
    const { data, error } = await this.supabase
      .from("email_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("workspace_id", workspaceId)
      .order("provider", { ascending: true });
    if (error || !data || !Array.isArray(data)) return [];
    return data.map(asAccount).filter((a): a is EmailAccountWithTokens => a !== null);
  }

  async upsertAccount(
    workspaceId: string,
    provider: EmailProvider,
    email: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string | null,
    tokenExpiresAt: string | null,
  ): Promise<string | null> {
    const { error } = await this.supabase.from("email_accounts").upsert(
      {
        workspace_id: workspaceId,
        provider,
        email: email.toLowerCase(),
        status: "connected",
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        last_sync_at: null,
      },
      { onConflict: "workspace_id,provider,email" },
    );
    return error ? error.message : null;
  }

  async updateAccountTokens(
    accountId: string,
    workspaceId: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string | null,
    tokenExpiresAt: string | null,
  ): Promise<string | null> {
    const { error } = await this.supabase
      .from("email_accounts")
      .update({
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        status: "connected",
      })
      .eq("workspace_id", workspaceId)
      .eq("id", accountId);
    return error ? error.message : null;
  }

  async updateAccountStatus(accountId: string, workspaceId: string, status: string): Promise<string | null> {
    const { error } = await this.supabase
      .from("email_accounts")
      .update({ status })
      .eq("workspace_id", workspaceId)
      .eq("id", accountId);
    return error ? error.message : null;
  }

  async updateLastSync(accountId: string, workspaceId: string, at: string): Promise<string | null> {
    const { error } = await this.supabase
      .from("email_accounts")
      .update({ last_sync_at: at })
      .eq("workspace_id", workspaceId)
      .eq("id", accountId);
    return error ? error.message : null;
  }

  async clearAccountTokens(accountId: string, workspaceId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from("email_accounts")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
      })
      .eq("workspace_id", workspaceId)
      .eq("id", accountId);
    return error ? error.message : null;
  }

  async supportsProviderColumns(workspaceId: string): Promise<boolean> {
    // A missing column surfaces as a PostgREST error mentioning the
    // column name; a live DB without migration 0005 fails here and the
    // sync action reports "run migration 0005" instead of crashing.
    const { error } = await this.supabase
      .from("conversations")
      .select("id, provider_thread_id, provider")
      .eq("workspace_id", workspaceId)
      .limit(1);
    if (!error) return true;
    return !/provider_thread_id|provider_message_id|column/i.test(error.message);
  }

  async messageExists(workspaceId: string, providerMessageId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("messages")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider_message_id", providerMessageId)
      .limit(1)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  }

  async findConversationByThreadId(
    workspaceId: string,
    provider: EmailProvider,
    providerThreadId: string,
  ): Promise<ConversationRef | null> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select("id, subject, provider, provider_thread_id")
      .eq("workspace_id", workspaceId)
      .eq("channel", "email")
      .eq("provider_thread_id", providerThreadId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as unknown as Record<string, unknown>;
    return {
      id: String(r.id),
      subject: typeof r.subject === "string" ? r.subject : null,
      provider: (r.provider as EmailProvider | null) ?? provider,
      provider_thread_id: typeof r.provider_thread_id === "string" ? r.provider_thread_id : null,
    };
  }

  async createConversation(
    workspaceId: string,
    contactId: string | null,
    provider: EmailProvider,
    providerThreadId: string,
    subject: string | null,
    language: string,
  ): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("conversations")
      .insert({
        workspace_id: workspaceId,
        contact_id: contactId,
        channel: "email",
        status: "open",
        priority: "normal",
        subject,
        language,
        provider,
        provider_thread_id: providerThreadId,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return { id: null, error: error?.message ?? "Could not create the conversation." };
    return { id: (data as { id: string }).id, error: null };
  }

  async findOrCreateContact(
    workspaceId: string,
    email: string,
    name: string | null,
  ): Promise<{ id: string | null; error: string | null }> {
    const address = email.trim().toLowerCase();
    const { data: existing } = await this.supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", address)
      .limit(1)
      .maybeSingle();
    if (existing) return { id: (existing as { id: string }).id, error: null };
    const { data, error } = await this.supabase
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        name: name ?? address,
        email: address,
        preferred_language: "en",
        channel: "email",
      })
      .select("id")
      .single();
    if (error || !data) return { id: null, error: error?.message ?? "Could not create the contact." };
    return { id: (data as { id: string }).id, error: null };
  }

  async insertMessage(
    workspaceId: string,
    conversationId: string,
    body: string,
    language: string,
    providerMessageId: string,
  ): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        sender_type: "customer",
        body,
        language,
        is_ai_draft: false,
        provider_message_id: providerMessageId,
      })
      .select("id")
      .single();
    if (error || !data) return { id: null, error: error?.message ?? "Could not save the message." };
    return { id: (data as { id: string }).id, error: null };
  }

  async touchConversation(workspaceId: string, conversationId: string, at: string): Promise<void> {
    await this.supabase
      .from("conversations")
      .update({ last_message_at: at })
      .eq("workspace_id", workspaceId)
      .eq("id", conversationId);
  }

  async getReplyContext(workspaceId: string, conversationId: string): Promise<ReplyContext | null> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select("id, channel, subject, provider, provider_thread_id, contacts ( email )")
      .eq("workspace_id", workspaceId)
      .eq("id", conversationId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as {
      id: string;
      channel: string;
      subject: string | null;
      provider: EmailProvider | null;
      provider_thread_id: string | null;
      contacts: { email: string | null } | null;
    };
    const { data: latest } = await this.supabase
      .from("messages")
      .select("provider_message_id")
      .eq("workspace_id", workspaceId)
      .eq("conversation_id", conversationId)
      .eq("sender_type", "customer")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestRow = latest as unknown as { provider_message_id: string | null } | null;
    return {
      conversation: {
        id: row.id,
        channel: row.channel,
        subject: row.subject,
        provider: row.provider,
        provider_thread_id: row.provider_thread_id,
      },
      contactEmail: row.contacts?.email ?? null,
      latestCustomerProviderMessageId: latestRow?.provider_message_id ?? null,
    };
  }

  async updateMessageProviderId(
    messageId: string,
    workspaceId: string,
    providerMessageId: string,
  ): Promise<string | null> {
    const { error } = await this.supabase
      .from("messages")
      .update({ provider_message_id: providerMessageId })
      .eq("workspace_id", workspaceId)
      .eq("id", messageId);
    return error ? error.message : null;
  }
}
