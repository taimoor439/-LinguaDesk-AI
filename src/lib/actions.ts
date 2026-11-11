"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentWorkspaceId,
  getCurrentUserRole,
} from "@/lib/db";
import { SupabaseEmailStore } from "@/lib/email/store";
import { sendEmailReply } from "@/lib/email/send";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Phase 2 server actions (Customer Support).
 *
 * Every action:
 * - resolves the signed-in user and the cookie-selected workspace,
 * - verifies workspace membership (and role where the action is
 *   privileged) before touching the database,
 * - runs through the anon client so Row Level Security still applies,
 * - never throws — failures are returned as `{ error }`,
 * - never invents data or claims a message was sent to a customer
 *   when it was only saved: chat replies reach the visitor through
 *   the widget poll (Phase 3), email replies are sent via the
 *   connected provider when one exists and otherwise degrade to
 *   saved-only (Phase 5).
 */

export type ActionResult<T = null> = { data: T | null; error: string | null };

const LANGUAGES = ["en", "de", "fr", "it"] as const;
const CONVERSATION_STATUSES = ["open", "pending", "resolved"] as const;
const INVITE_ROLES = ["admin", "agent"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ActionResult<T> {
  return { data: null, error };
}

export interface WorkspaceContext {
  user: User;
  workspaceId: string;
  role: string;
}

/**
 * Resolve the caller + workspace, or return the error. Exported so the
 * Phase 4 action modules (AI, knowledge base) share the same
 * membership check instead of re-implementing it.
 */
export async function requireWorkspace(): Promise<
  { context: WorkspaceContext; error: null } | { context: null; error: string }
> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { context: null, error: "You must be signed in." };
  }
  const { data: workspaceId, error: workspaceError } = await getCurrentWorkspaceId();
  if (workspaceError || !workspaceId) {
    return { context: null, error: workspaceError ?? "No workspace selected." };
  }
  const { data: role, error: roleError } = await getCurrentUserRole(workspaceId);
  if (roleError || !role) {
    return { context: null, error: roleError ?? "You are not a member of this workspace." };
  }
  return { context: { user: userData.user, workspaceId, role }, error: null };
}

/** True when the conversation id belongs to the workspace. */
async function conversationExists(
  supabase: SupabaseClient,
  workspaceId: string,
  conversationId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", conversationId)
    .maybeSingle();
  return Boolean(data);
}

function isLanguage(value: string): value is (typeof LANGUAGES)[number] {
  return (LANGUAGES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function updateConversationStatus(
  conversationId: string,
  status: string,
): Promise<ActionResult> {
  if (!(CONVERSATION_STATUSES as readonly string[]).includes(status)) {
    return fail("Invalid status. Use open, pending or resolved.");
  }
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  if (!(await conversationExists(supabase, context.workspaceId, conversationId))) {
    return fail("Conversation not found in this workspace.");
  }
  const { error: updateError } = await supabase
    .from("conversations")
    .update({ status })
    .eq("workspace_id", context.workspaceId)
    .eq("id", conversationId);
  if (updateError) return fail(updateError.message);

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  revalidatePath("/dashboard/overview");
  return ok(null);
}

export async function assignConversation(
  conversationId: string,
  assigneeUserId: string | null,
): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  if (!(await conversationExists(supabase, context.workspaceId, conversationId))) {
    return fail("Conversation not found in this workspace.");
  }

  if (assigneeUserId) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", context.workspaceId)
      .eq("user_id", assigneeUserId)
      .maybeSingle();
    if (!member) return fail("That person is not a member of this workspace.");
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ assigned_to: assigneeUserId })
    .eq("workspace_id", context.workspaceId)
    .eq("id", conversationId);
  if (updateError) return fail(updateError.message);

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  revalidatePath("/dashboard/overview");
  return ok(null);
}

export interface ReplyResult {
  /** Provider the reply was actually sent through, or null when it was only saved. */
  sentVia: string | null;
  /** Provider message id when the provider returned one (proof of send). */
  providerMessageId: string | null;
  /** True when the reply was saved to the thread but NOT sent. */
  savedOnly: boolean;
}

export async function addConversationMessage(
  conversationId: string,
  body: string,
  kind: "reply" | "note",
): Promise<ActionResult<ReplyResult>> {
  const text = body.trim();
  if (!text) return fail("Write a message first.");
  if (text.length > 10000) return fail("Message is too long (max 10,000 characters).");
  if (kind !== "reply" && kind !== "note") return fail("Invalid message type.");

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, language, channel")
    .eq("workspace_id", context.workspaceId)
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return fail("Conversation not found in this workspace.");
  const conv = conversation as { language: string; channel: string };

  // Replies are agent messages saved to the thread. Internal notes are
  // stored with sender_type "system" so they are clearly agent-only.
  const { data: inserted, error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    workspace_id: context.workspaceId,
    sender_type: kind === "reply" ? "agent" : "system",
    sender_id: context.user.id,
    body: text,
    language: conv.language ?? "en",
    is_ai_draft: false,
  }).select("id").single();
  if (insertError) return fail(insertError.message);

  // A reply is the newest customer-visible activity; an internal note
  // must not move the conversation up the inbox.
  if (kind === "reply") {
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("workspace_id", context.workspaceId)
      .eq("id", conversationId);
  }

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  revalidatePath("/dashboard/overview");

  // Phase 5 (e): for email conversations, try to SEND the reply via
  // the connected provider. The reply is already saved above, so a
  // send failure (or no connected account) degrades honestly to
  // saved-only — the UI reports "Saved to thread — not sent" and
  // never claims it went out.
  if (kind === "reply" && conv.channel === "email") {
    const store = new SupabaseEmailStore(supabase);
    let sendResult: { sent: boolean; sentVia: string | null; providerMessageId: string | null };
    try {
      sendResult = await sendEmailReply(store, context.workspaceId, conversationId, text);
    } catch {
      sendResult = { sent: false, sentVia: null, providerMessageId: null };
    }
    if (sendResult.sent) {
      // Store the provider's message id as proof of send. The update
      // is best-effort: before migration 0005 is applied the column
      // does not exist, and the send itself still happened.
      if (sendResult.providerMessageId && inserted) {
        await store.updateMessageProviderId(
          (inserted as { id: string }).id,
          context.workspaceId,
          sendResult.providerMessageId,
        );
      }
      return ok({
        sentVia: sendResult.sentVia,
        providerMessageId: sendResult.providerMessageId,
        savedOnly: false,
      });
    }
    return ok({ sentVia: null, providerMessageId: null, savedOnly: true });
  }

  return ok({ sentVia: null, providerMessageId: null, savedOnly: kind === "reply" });
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface ContactInput {
  name: string | null;
  email: string | null;
  phone: string | null;
  preferred_language: string;
  channel: string | null;
  notes: string | null;
}

function validateContactInput(input: ContactInput): string | null {
  if (input.email && !EMAIL_RE.test(input.email)) {
    return "Enter a valid email address.";
  }
  if (!isLanguage(input.preferred_language)) {
    return "Choose a supported language (en, de, fr, it).";
  }
  if (input.name && input.name.length > 200) return "Name is too long.";
  if (input.phone && input.phone.length > 50) return "Phone number is too long.";
  return null;
}

export async function createContact(
  input: ContactInput,
): Promise<ActionResult<{ id: string }>> {
  const validationError = validateContactInput(input);
  if (validationError) return fail(validationError);
  if (!input.name && !input.email && !input.phone) {
    return fail("Add at least a name, email or phone number.");
  }

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("contacts")
    .insert({ ...input, workspace_id: context.workspaceId })
    .select("id")
    .single();
  if (insertError || !data) return fail(insertError?.message ?? "Could not create the contact.");

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/overview");
  return ok({ id: (data as { id: string }).id });
}

export async function updateContact(
  contactId: string,
  input: ContactInput,
): Promise<ActionResult> {
  const validationError = validateContactInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: updateError } = await supabase
    .from("contacts")
    .update(input)
    .eq("workspace_id", context.workspaceId)
    .eq("id", contactId)
    .select("id")
    .maybeSingle();
  if (updateError) return fail(updateError.message);
  if (!data) return fail("Contact not found in this workspace.");

  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${contactId}`);
  return ok(null);
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: deleteError } = await supabase
    .from("contacts")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", contactId)
    .select("id")
    .maybeSingle();
  if (deleteError) return fail(deleteError.message);
  if (!data) return fail("Contact not found in this workspace.");

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/overview");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Saved replies
// ---------------------------------------------------------------------------

export interface SavedReplyInput {
  title: string;
  body: string;
  language: string;
}

function validateSavedReplyInput(input: SavedReplyInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (!input.body.trim()) return "Reply text is required.";
  if (!isLanguage(input.language)) return "Choose a supported language (en, de, fr, it).";
  if (input.title.trim().length > 200) return "Title is too long.";
  return null;
}

export async function createSavedReply(
  input: SavedReplyInput,
): Promise<ActionResult<{ id: string }>> {
  const validationError = validateSavedReplyInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("saved_replies")
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      language: input.language,
      workspace_id: context.workspaceId,
      created_by: context.user.id,
    })
    .select("id")
    .single();
  if (insertError || !data) return fail(insertError?.message ?? "Could not create the saved reply.");

  revalidatePath("/dashboard/saved-replies");
  return ok({ id: (data as { id: string }).id });
}

export async function updateSavedReply(
  replyId: string,
  input: SavedReplyInput,
): Promise<ActionResult> {
  const validationError = validateSavedReplyInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: updateError } = await supabase
    .from("saved_replies")
    .update({
      title: input.title.trim(),
      body: input.body.trim(),
      language: input.language,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", replyId)
    .select("id")
    .maybeSingle();
  if (updateError) return fail(updateError.message);
  if (!data) return fail("Saved reply not found in this workspace.");

  revalidatePath("/dashboard/saved-replies");
  return ok(null);
}

export async function deleteSavedReply(replyId: string): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: deleteError } = await supabase
    .from("saved_replies")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", replyId)
    .select("id")
    .maybeSingle();
  if (deleteError) return fail(deleteError.message);
  if (!data) return fail("Saved reply not found in this workspace.");

  revalidatePath("/dashboard/saved-replies");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export interface InviteResult {
  inviteLink: string;
  token: string;
  email: string;
}

export async function inviteTeamMember(
  email: string,
  role: string,
): Promise<ActionResult<InviteResult>> {
  const address = email.trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return fail("Enter a valid email address.");
  if (!(INVITE_ROLES as readonly string[]).includes(role)) {
    return fail("Role must be admin or agent.");
  }

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);
  if (context.role !== "owner" && context.role !== "admin") {
    return fail("Only workspace owners and admins can invite teammates.");
  }

  const supabase = await createClient();

  // One pending invitation per email — never stack duplicates.
  const { data: existing } = await supabase
    .from("team_invitations")
    .select("id, expires_at")
    .eq("workspace_id", context.workspaceId)
    .eq("email", address)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing) return fail("An invitation is already pending for this email.");

  const token = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("team_invitations").insert({
    workspace_id: context.workspaceId,
    email: address,
    role,
    token,
    invited_by: context.user.id,
    expires_at: expiresAt,
  });
  if (insertError) return fail(insertError.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteLink = `${appUrl.replace(/\/$/, "")}/accept-invite?token=${token}`;

  revalidatePath("/dashboard/team");
  return ok({ inviteLink, token, email: address });
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);
  if (context.role !== "owner" && context.role !== "admin") {
    return fail("Only workspace owners and admins can remove teammates.");
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("workspace_id", context.workspaceId)
    .eq("id", memberId)
    .maybeSingle();
  if (!target) return fail("Team member not found in this workspace.");

  const member = target as { id: string; user_id: string; role: string };
  if (member.role === "owner") {
    return fail("The workspace owner cannot be removed.");
  }
  if (member.user_id === context.user.id) {
    // A sole owner removing themselves would orphan the workspace.
    const { data: owners } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", context.workspaceId)
      .eq("role", "owner");
    const ownerIds = (owners ?? []) as { user_id: string }[];
    if (ownerIds.length <= 1) {
      return fail("You are the only owner. Add another owner before removing yourself.");
    }
  }

  const { error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", memberId);
  if (deleteError) return fail(deleteError.message);

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/overview");
  return ok(null);
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);
  if (context.role !== "owner" && context.role !== "admin") {
    return fail("Only workspace owners and admins can revoke invitations.");
  }

  const supabase = await createClient();
  const { data, error: deleteError } = await supabase
    .from("team_invitations")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", invitationId)
    .is("accepted_at", null)
    .select("id")
    .maybeSingle();
  if (deleteError) return fail(deleteError.message);
  if (!data) return fail("Pending invitation not found in this workspace.");

  revalidatePath("/dashboard/team");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Widget config (Phase 3 — Website Live Chat)
// ---------------------------------------------------------------------------

export interface WidgetConfigInput {
  name: string | null;
  welcome_message: string | null;
  brand_color: string;
  position: string;
  collect_name: boolean;
  collect_email: boolean;
  greeting_message: string | null;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const WIDGET_POSITIONS = ["bottom-right", "bottom-left"] as const;

function validateWidgetConfigInput(input: WidgetConfigInput): string | null {
  if (!HEX_COLOR_RE.test(input.brand_color)) {
    return "Brand colour must be a hex colour, e.g. #0D9488.";
  }
  if (!(WIDGET_POSITIONS as readonly string[]).includes(input.position)) {
    return "Position must be bottom-right or bottom-left.";
  }
  if (typeof input.collect_name !== "boolean" || typeof input.collect_email !== "boolean") {
    return "Collect name/email must be true or false.";
  }
  if (input.name && input.name.length > 200) return "Widget name is too long.";
  if (input.welcome_message && input.welcome_message.length > 500) {
    return "Welcome message is too long.";
  }
  if (input.greeting_message && input.greeting_message.length > 500) {
    return "Greeting message is too long.";
  }
  return null;
}

/**
 * Create or update the current workspace's widget config (one row per
 * workspace — upsert on workspace_id). Any workspace member may edit
 * it; the public widget only reads it.
 */
export async function upsertWidgetConfig(
  input: WidgetConfigInput,
): Promise<ActionResult> {
  const validationError = validateWidgetConfigInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { error: upsertError } = await supabase.from("widget_configs").upsert(
    {
      workspace_id: context.workspaceId,
      name: input.name?.trim() || null,
      welcome_message: input.welcome_message?.trim() || null,
      brand_color: input.brand_color,
      position: input.position,
      collect_name: input.collect_name,
      collect_email: input.collect_email,
      greeting_message: input.greeting_message?.trim() || null,
    },
    { onConflict: "workspace_id" },
  );
  if (upsertError) return fail(upsertError.message);

  revalidatePath("/dashboard/live-chat");
  return ok(null);
}
