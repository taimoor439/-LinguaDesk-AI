import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
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
  /** Conversations resolved in the last 7 days. */
  resolvedThisWeek: number;
  /** Open or pending conversations with no one assigned. */
  unassignedConversations: number;
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
  /** Phase 5 (migration 0005): which provider owns an email thread. */
  provider?: string | null;
  /** Phase 5 (migration 0005): provider thread id (Gmail threadId / Graph conversationId). */
  provider_thread_id?: string | null;
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
  /** Per-workspace opt-in for AI auto-reply (migration 0007). */
  ai_auto_reply: boolean;
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

export interface MessageRow {
  id: string;
  conversation_id: string;
  workspace_id: string;
  sender_type: string;
  sender_id: string | null;
  body: string;
  language: string | null;
  is_ai_draft: boolean;
  created_at: string;
  /** Phase 5 (migration 0005): provider message id, when the message came from / was sent via a provider. */
  provider_message_id?: string | null;
  /** Resolved display name of the sender (agent), when known. */
  sender_name: string | null;
  /** Resolved email of the sender (agent), when known. */
  sender_email: string | null;
}

export interface TeamInvitationRow {
  id: string;
  workspace_id: string;
  email: string | null;
  role: string;
  token: string | null;
  invited_by: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Cookie that stores the workspace the user picked in the sidebar. */
export const WORKSPACE_COOKIE = "linguadesk_workspace_id";

/**
 * The workspace id the user picked in the sidebar switcher, or null.
 * Never throws — returns null outside a request context.
 */
export function getSelectedWorkspaceId(): string | null {
  try {
    return cookies().get(WORKSPACE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
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
 * The workspace the signed-in user is currently working in.
 *
 * Resolution order:
 * 1. The workspace picked in the sidebar switcher (stored in the
 *    `linguadesk_workspace_id` cookie) — but only if the user is still
 *    a member of it.
 * 2. Otherwise the user's first membership (oldest first).
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
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: error.message };
  const rows = asRows<{ workspace_id: string }>(data);
  if (rows.length === 0) return { data: null, error: null };

  const selected = getSelectedWorkspaceId();
  if (selected && rows.some((row) => row.workspace_id === selected)) {
    return { data: selected, error: null };
  }
  return { data: rows[0].workspace_id, error: null };
}

/**
 * The signed-in user's role in a workspace: "owner" | "admin" | "agent".
 * Returns null when the user is not a member of the workspace.
 */
export async function getCurrentUserRole(
  workspaceId: string,
): Promise<DbResult<string | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError?.message ?? "No signed-in user." };
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  const row = data as unknown as { role: string } | null;
  return { data: row?.role ?? null, error: null };
}

/**
 * Look up profile display info for a list of auth user ids.
 *
 * The `profiles` table's RLS only lets a user see their own row, so the
 * anon client cannot resolve teammates. The service-role client (server
 * only) is used here, and only for ids already proven to be members of
 * the caller's workspace. Returns an empty map when the admin client
 * is unavailable, so callers fall back to showing the user id.
 */
export async function getProfilesByIds(
  userIds: string[],
): Promise<Map<string, { email: string | null; full_name: string | null; avatar_url: string | null }>> {
  const empty = new Map<string, { email: string | null; full_name: string | null; avatar_url: string | null }>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return empty;

  const admin = getAdminClient();
  if (!admin) return empty;

  try {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", unique);
    if (error || !data) return empty;
    const map = new Map<string, { email: string | null; full_name: string | null; avatar_url: string | null }>();
    for (const p of asRows<{ id: string; email: string | null; full_name: string | null; avatar_url: string | null }>(data)) {
      map.set(p.id, { email: p.email, full_name: p.full_name, avatar_url: p.avatar_url });
    }
    return map;
  } catch {
    return empty;
  }
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
  const empty: DashboardStats = {
    totalConversations: 0,
    openConversations: 0,
    pendingConversations: 0,
    resolvedConversations: 0,
    resolvedThisWeek: 0,
    unassignedConversations: 0,
    totalContacts: 0,
  };
  if (!supabase) {
    return { data: empty, error: NOT_CONFIGURED };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [total, open, pending, resolved, contacts, resolvedWeek, unassigned] =
    await Promise.all([
      countRows(supabase, "conversations", workspaceId),
      countRows(supabase, "conversations", workspaceId, { status: "open" }),
      countRows(supabase, "conversations", workspaceId, { status: "pending" }),
      countRows(supabase, "conversations", workspaceId, { status: "resolved" }),
      countRows(supabase, "contacts", workspaceId),
      // Resolved in the last 7 days (by last update).
      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "resolved")
        .gte("updated_at", sevenDaysAgo),
      // Open or pending with nobody assigned.
      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["open", "pending"])
        .is("assigned_to", null),
    ]);

  const firstError =
    total.error ??
    open.error ??
    pending.error ??
    resolved.error ??
    contacts.error ??
    toError(resolvedWeek.error) ??
    toError(unassigned.error);

  return {
    data: {
      totalConversations: total.count,
      openConversations: open.count,
      pendingConversations: pending.count,
      resolvedConversations: resolved.count,
      resolvedThisWeek: resolvedWeek.count ?? 0,
      unassignedConversations: unassigned.count ?? 0,
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

export interface ConversationDetail extends ConversationRow {
  /** Resolved display name of the assigned agent, when known. */
  assignee_name: string | null;
  /** Resolved email of the assigned agent, when known. */
  assignee_email: string | null;
}

/**
 * One conversation, workspace-scoped. Returns null data when the
 * conversation does not exist or belongs to another workspace.
 */
export async function getConversationById(
  workspaceId: string,
  conversationId: string,
): Promise<DbResult<ConversationDetail | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("conversations")
    .select("*, contacts ( name, email )")
    .eq("workspace_id", workspaceId)
    .eq("id", conversationId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  const row = data as unknown as ConversationRow | null;
  if (!row) return { data: null, error: null };

  let assignee_name: string | null = null;
  let assignee_email: string | null = null;
  if (row.assigned_to) {
    const profiles = await getProfilesByIds([row.assigned_to]);
    const profile = profiles.get(row.assigned_to);
    assignee_name = profile?.full_name ?? null;
    assignee_email = profile?.email ?? null;
  }

  return { data: { ...row, assignee_name, assignee_email }, error: null };
}

/**
 * The full message thread of a conversation, oldest first.
 * Internal notes (sender_type "system") are included — they are only
 * ever rendered in the agent dashboard, never to customers.
 * Agent display names are resolved from profiles where known.
 */
export async function getMessages(
  workspaceId: string,
  conversationId: string,
): Promise<DbResult<MessageRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return { data: [], error: error.message };

  const rows = asRows<Omit<MessageRow, "sender_name" | "sender_email">>(data);
  const senderIds = rows
    .filter((m) => m.sender_type === "agent" && m.sender_id)
    .map((m) => m.sender_id as string);
  const profiles = await getProfilesByIds(senderIds);

  return {
    data: rows.map((m) => ({
      ...m,
      sender_name:
        m.sender_type === "agent" && m.sender_id
          ? (profiles.get(m.sender_id)?.full_name ?? null)
          : null,
      sender_email:
        m.sender_type === "agent" && m.sender_id
          ? (profiles.get(m.sender_id)?.email ?? null)
          : null,
    })),
    error: null,
  };
}

/** One contact, workspace-scoped. Null when it does not exist here. */
export async function getContactById(
  workspaceId: string,
  contactId: string,
): Promise<DbResult<ContactRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .maybeSingle();

  return { data: (data as unknown as ContactRow | null) ?? null, error: toError(error) };
}

/** Conversations belonging to one contact, newest first. */
export async function getContactConversations(
  workspaceId: string,
  contactId: string,
): Promise<DbResult<ConversationRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("conversations")
    .select("*, contacts ( name, email )")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50);

  return { data: asRows<ConversationRow>(data), error: toError(error) };
}

/** One saved reply, workspace-scoped. Null when it does not exist here. */
export async function getSavedReplyById(
  workspaceId: string,
  replyId: string,
): Promise<DbResult<SavedReplyRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("saved_replies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", replyId)
    .maybeSingle();

  return { data: (data as unknown as SavedReplyRow | null) ?? null, error: toError(error) };
}

/**
 * All invitations for a workspace, pending ones first (not yet accepted
 * and not expired), then the rest, newest first.
 */
export async function getTeamInvitations(
  workspaceId: string,
): Promise<DbResult<TeamInvitationRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { data: [], error: error.message };

  const rows = asRows<TeamInvitationRow>(data);
  const now = Date.now();
  const isPending = (row: TeamInvitationRow) =>
    !row.accepted_at && (!row.expires_at || new Date(row.expires_at).getTime() > now);
  return {
    data: [...rows.filter(isPending), ...rows.filter((row) => !isPending(row))],
    error: null,
  };
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
    .order("name", { ascending: true })
    .limit(100);

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

/**
 * One knowledge-base article, workspace-scoped. Null when it does not
 * exist here.
 */
export async function getKnowledgeBaseArticleById(
  workspaceId: string,
  articleId: string,
): Promise<DbResult<KnowledgeBaseArticleRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("knowledge_base_articles")
    .select("*, knowledge_base_categories ( name )")
    .eq("workspace_id", workspaceId)
    .eq("id", articleId)
    .maybeSingle();

  return { data: (data as unknown as KnowledgeBaseArticleRow | null) ?? null, error: toError(error) };
}

/**
 * One knowledge-base category, workspace-scoped. Null when it does not
 * exist here.
 */
export async function getKnowledgeBaseCategoryById(
  workspaceId: string,
  categoryId: string,
): Promise<DbResult<KnowledgeBaseCategoryRow | null>> {
  const supabase = await getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("knowledge_base_categories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", categoryId)
    .maybeSingle();

  return { data: (data as unknown as KnowledgeBaseCategoryRow | null) ?? null, error: toError(error) };
}

export interface GroundingArticleRow {
  id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
}

/**
 * PUBLISHED knowledge-base articles only — the only articles AI
 * grounding may use. Draft articles are never fed to the model.
 */
export async function getPublishedArticlesForGrounding(
  workspaceId: string,
): Promise<DbResult<GroundingArticleRow[]>> {
  const supabase = await getClient();
  if (!supabase) return { data: [], error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("knowledge_base_articles")
    .select("id, title, slug, content")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(100);

  return { data: asRows<GroundingArticleRow>(data), error: toError(error) };
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
    .order("created_at", { ascending: true })
    .limit(100);

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
  // Teammates' profiles are not visible through the anon client (profiles
  // RLS only exposes your own row), so resolve them via the admin client.
  // Falls back to an empty map when the service-role key is not configured.
  const byId = await getProfilesByIds(userIds);

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

export interface ChatNeedsAttention {
  /** Handoff requests: priority 'high' + status 'pending'. */
  handoffs: ConversationRow[];
  /** Open chats with nobody assigned. */
  unassigned: ConversationRow[];
}

/**
 * Chat conversations that need a human: handoff requests plus open
 * chats with nobody assigned. Honest counts only — no invented data.
 */
export async function getChatNeedsAttention(
  workspaceId: string,
): Promise<DbResult<ChatNeedsAttention>> {
  const empty: ChatNeedsAttention = { handoffs: [], unassigned: [] };
  const { data, error } = await getConversations(workspaceId, {
    channel: "chat",
    limit: 100,
  });
  if (error) return { data: empty, error };
  return {
    data: {
      handoffs: data.filter(
        (c) => c.priority === "high" && c.status === "pending",
      ),
      unassigned: data.filter(
        (c) => c.status === "open" && !c.assigned_to,
      ),
    },
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
    .order("provider", { ascending: true })
    .limit(10);

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
