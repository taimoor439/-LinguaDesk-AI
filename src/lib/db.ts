import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side data helpers for LinguaDesk AI.
 *
 * Every helper queries the real Supabase tables — no invented data.
 * Every helper returns `{ data, error }` and never throws when Supabase
 * is unconfigured or a query fails; callers render an honest empty
 * state instead.
 */

export type DbResult<T> = { data: T; error: string | null };

export interface DashboardStats {
  totalConversations: number;
  openConversations: number;
  pendingConversations: number;
  resolvedConversations: number;
  totalContacts: number;
}

export interface ConversationRow {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  channel: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  subject: string | null;
  language: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  contacts: { name: string | null; email: string | null } | null;
}

export interface ContactRow {
  id: string;
  workspace_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  preferred_language: string;
  channel: string | null;
  notes: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseArticleRow {
  id: string;
  workspace_id: string;
  category_id: string | null;
  title: string | null;
  slug: string | null;
  content: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  knowledge_base_categories: { name: string | null } | null;
}

export interface KnowledgeBaseCategoryRow {
  id: string;
  workspace_id: string;
  name: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedReplyRow {
  id: string;
  workspace_id: string;
  title: string | null;
  body: string | null;
  language: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface WidgetConfigRow {
  id: string;
  workspace_id: string;
  name: string | null;
  welcome_message: string | null;
  brand_color: string;
  position: string;
  collect_name: boolean;
  collect_email: boolean;
  greeting_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailAccountRow {
  id: string;
  workspace_id: string;
  provider: string;
  email: string | null;
  status: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettingsRow {
  id: string;
  workspace_id: string;
  default_language: string;
  ai_enabled: boolean;
  ai_auto_draft: boolean;
  data_retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiDraftMessageRow {
  id: string;
  conversation_id: string;
  workspace_id: string;
  sender_type: string;
  body: string;
  language: string | null;
  is_ai_draft: boolean;
  created_at: string;
  conversations: { subject: string | null } | null;
}

export interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  aiDraftCount: number;
  byStatus: { status: string; count: number }[];
  byChannel: { channel: string; count: number }[];
  byLanguage: { language: string; count: number }[];
}

const NOT_CONFIGURED = "Supabase is not configured.";

async function getClient(): Promise<SupabaseClient | null> {
  try {
    return await createClient();
  } catch {
    return null;
  }
}

function toError(error: { message: string } | null): string | null {
  return error ? error.message : null;
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The first workspace the signed-in user is a member of.
 * Returns null data when there is no signed-in user or no membership.
 */
export async function getCurrentWorkspaceId(): Promise<DbResult<string | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError?.message ?? "No signed-in user." };
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  const row = data as unknown as { workspace_id: string } | null;
  return { data: row?.workspace_id ?? null, error: null };
}

export async function getWorkspace(
  workspaceId: string,
): Promise<DbResult<WorkspaceRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  return { data: (data as unknown as WorkspaceRow | null) ?? null, error: toError(error) };
}

async function countRows(
  supabase: SupabaseClient,
  table: string,
  workspaceId: string,
  filters?: Record<string, string | boolean>,
): Promise<{ count: number; error: string | null }> {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
  }
  const { count, error } = await query;
  return { count: count ?? 0, error: toError(error) };
}

export async function getDashboardStats(
  workspaceId: string,
): Promise<DbResult<DashboardStats>> {
  const supabase = await getClient();
  if (!supabase) {
    return {
      data: {
        totalConversations: 0,
        openConversations: 0,
        pendingConversations: 0,
        resolvedConversations: 0,
        totalContacts: 0,
      },
      error: NOT_CONFIGURED,
    };
  }

  const [total, open, pending, resolved, contacts] = await Promise.all([
    countRows(supabase, "conversations", workspaceId),
    countRows(supabase, "conversations", workspaceId, { status: "open" }),
    countRows(supabase, "conversations", workspaceId, { status: "pending" }),
    countRows(supabase, "conversations", workspaceId, { status: "resolved" }),
    countRows(supabase, "contacts", workspaceId),
  ]);

  const firstError =
    total.error ?? open.error ?? pending.error ?? resolved.error ?? contacts.error;

  return {
    data: {
      totalConversations: total.count,
      openConversations: open.count,
      pendingConversations: pending.count,
      resolvedConversations: resolved.count,
      totalContacts: contacts.count,
    },
    error: firstError,
  };
}

export async function getRecentConversations(
  workspaceId: string,
  limit = 10,
): Promise<DbResult<ConversationRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("conversations")
    .select("*, contacts ( name, email )")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: asRows<ConversationRow>(data), error: toError(error) };
}

export async function getConversations(
  workspaceId: string,
  opts?: { status?: string; channel?: string; limit?: number },
): Promise<DbResult<ConversationRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  let query = supabase
    .from("conversations")
    .select("*, contacts ( name, email )")
    .eq("workspace_id", workspaceId);

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.channel) query = query.eq("channel", opts.channel);

  const { data, error } = await query
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  return { data: asRows<ConversationRow>(data), error: toError(error) };
}

export async function getContacts(
  workspaceId: string,
): Promise<DbResult<ContactRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })
    .limit(200);

  return { data: asRows<ContactRow>(data), error: toError(error) };
}

export async function getKnowledgeBaseCategories(
  workspaceId: string,
): Promise<DbResult<KnowledgeBaseCategoryRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("knowledge_base_categories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  return { data: asRows<KnowledgeBaseCategoryRow>(data), error: toError(error) };
}

export async function getKnowledgeBaseArticles(
  workspaceId: string,
): Promise<DbResult<KnowledgeBaseArticleRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("knowledge_base_articles")
    .select("*, knowledge_base_categories ( name )")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  return { data: asRows<KnowledgeBaseArticleRow>(data), error: toError(error) };
}

export async function getSavedReplies(
  workspaceId: string,
): Promise<DbResult<SavedReplyRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("saved_replies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("title", { ascending: true })
    .limit(100);

  return { data: asRows<SavedReplyRow>(data), error: toError(error) };
}

export async function getTeamMembers(
  workspaceId: string,
): Promise<DbResult<TeamMemberRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: error.message };

  const members = asRows<{
    id: string;
    workspace_id: string;
    user_id: string;
    role: string;
    created_at: string;
    updated_at: string;
  }>(data);

  if (members.length === 0) return { data: [], error: null };

  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds);

  if (profilesError) return { data: [], error: profilesError.message };

  const byId = new Map<string, { email: string | null; full_name: string | null; avatar_url: string | null }>();
  for (const p of asRows<{ id: string; email: string | null; full_name: string | null; avatar_url: string | null }>(profiles)) {
    byId.set(p.id, p);
  }

  return {
    data: members.map((m) => ({
      ...m,
      email: byId.get(m.user_id)?.email ?? null,
      full_name: byId.get(m.user_id)?.full_name ?? null,
      avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
    })),
    error: null,
  };
}

export async function getWidgetConfig(
  workspaceId: string,
): Promise<DbResult<WidgetConfigRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("widget_configs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return { data: (data as unknown as WidgetConfigRow | null) ?? null, error: toError(error) };
}

export async function getEmailAccounts(
  workspaceId: string,
): Promise<DbResult<EmailAccountRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, workspace_id, provider, email, status, last_sync_at, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("provider", { ascending: true });

  return { data: asRows<EmailAccountRow>(data), error: toError(error) };
}

export async function getAiDraftMessages(
  workspaceId: string,
  limit = 20,
): Promise<DbResult<AiDraftMessageRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("messages")
    .select("*, conversations ( subject )")
    .eq("workspace_id", workspaceId)
    .eq("is_ai_draft", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: asRows<AiDraftMessageRow>(data), error: toError(error) };
}

export async function getWorkspaceSettings(
  workspaceId: string,
): Promise<DbResult<WorkspaceSettingsRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return { data: (data as unknown as WorkspaceSettingsRow | null) ?? null, error: toError(error) };
}

export async function getAnalytics(
  workspaceId: string,
): Promise<DbResult<AnalyticsData>> {
  const supabase = await getClient();
  const empty: AnalyticsData = {
    totalConversations: 0,
    totalMessages: 0,
    aiDraftCount: 0,
    byStatus: [],
    byChannel: [],
    byLanguage: [],
  };
  if (!supabase) return { data: empty, error: NOT_CONFIGURED };

  const [conversations, messages, aiDrafts] = await Promise.all([
    supabase
      .from("conversations")
      .select("status, channel, language")
      .eq("workspace_id", workspaceId)
      .limit(1000),
    countRows(supabase, "messages", workspaceId),
    countRows(supabase, "messages", workspaceId, { is_ai_draft: true }),
  ]);

  if (conversations.error) {
    return { data: empty, error: conversations.error.message };
  }

  const rows = asRows<{ status: string; channel: string; language: string }>(
    conversations.data,
  );

  const tally = (key: "status" | "channel" | "language") => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const value = row[key] || "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  const byStatus = tally("status").map((r) => ({ status: r.value, count: r.count }));
  const byChannel = tally("channel").map((r) => ({ channel: r.value, count: r.count }));
  const byLanguage = tally("language").map((r) => ({ language: r.value, count: r.count }));

  return {
    data: {
      totalConversations: rows.length,
      totalMessages: messages.count,
      aiDraftCount: aiDrafts.count,
      byStatus,
      byChannel,
      byLanguage,
    },
    error: messages.error ?? aiDrafts.error,
  };
}
