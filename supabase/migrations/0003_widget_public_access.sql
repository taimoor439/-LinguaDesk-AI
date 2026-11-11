-- ============================================================================
-- LinguaDesk AI — 0003_widget_public_access
--
-- Public (anonymous) access for the embeddable website chat widget.
--
-- WHY THIS EXISTS
--   The widget runs on third-party websites with no signed-in user, so it
--   talks to Supabase through the anon key. The 0001 policies only let
--   workspace members read/write tenant tables, which would block every
--   visitor. This migration adds narrowly-scoped anonymous access ONLY
--   for chat conversations in workspaces that have a widget configured.
--
-- WHAT ANON CAN DO AFTER THIS MIGRATION
--   * SELECT widget_configs — the config is public by design (a website
--     owner embeds it on their own public site).
--   * INSERT contacts — only when a widget_configs row exists for that
--     workspace.
--   * INSERT conversations — only when channel = 'chat' AND a
--     widget_configs row exists for that workspace.
--   * INSERT messages — only when the parent conversation is a 'chat'
--     conversation in a widget-configured workspace AND sender_type is
--     'customer' or 'system'. The public path can NEVER insert an
--     'agent' or 'ai' message.
--   * SELECT messages — only for 'chat' conversations in
--     widget-configured workspaces. NOTE: this policy permits the row,
--     including internal notes (sender_type = 'system'); the API layer
--     (/api/widget/conversations/[id]/messages) MUST filter those out
--     and never return them to visitors. The policy alone does not
--     hide internal notes.
--   * NO anon SELECT on conversations and NO anon SELECT on contacts:
--     the widget never needs them (it remembers the conversation id
--     in the visitor's own browser storage).
--   * NO anon UPDATE/DELETE on contacts, messages or widget_configs.
--   * NO anon UPDATE on conversations via policy at all. The two
--     mutations the public API needs (bump last_message_at, flag a
--     human handoff) go through the SECURITY DEFINER functions below,
--     which only touch 'chat' conversations in widget-configured
--     workspaces and change nothing else.
--
-- SECURITY DEFINER FUNCTIONS (all owned by the migration, search_path
-- locked to public, EXECUTE granted only to anon):
--   * find_chat_context — dedupe lookup for a returning visitor: the
--     open chat conversation and/or contact for a workspace + email.
--     Returns ids only, never any other workspace's data.
--   * get_chat_conversation_workspace — proves a conversation id is a
--     widget chat conversation and returns its workspace id, so the
--     API can answer 404 vs 200 without granting anon SELECT on
--     conversations.
--   * touch_chat_conversation — bumps last_message_at on a widget chat
--     conversation after a visitor message is stored.
--   * request_chat_handoff — sets priority 'high' + status 'pending'
--     and stores the agent-only system note "Visitor requested a human
--     agent" on a widget chat conversation.
--
-- LIMITATIONS (honest)
--   * Knowing a conversation UUID is enough to read its customer-visible
--     messages or append to it — the same "secret link" pattern as an
--     unlisted URL. Conversation ids are unguessable UUIDs; do not put
--     them in public pages.
--   * Rate limiting lives in the Next.js API layer (in-memory, per
--     process); it does not protect direct PostgREST access.
--   * INSERT ... RETURNING (what PostgREST does for `.select()` after
--     an insert) is NOT usable by anon on contacts/conversations:
--     the returned row must also pass a SELECT policy, and anon has
--     none on those tables, so the whole statement fails RLS even
--     though the insert itself is allowed. The API therefore generates
--     ids in the route handler and inserts without RETURNING. (Anon
--     DOES have SELECT on messages, so message rows can be read back.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: does this workspace have a widget configured?
-- SECURITY DEFINER so anon callers can evaluate it inside policies without
-- needing SELECT on widget_configs through the member-only policy.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_has_widget(wid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.widget_configs where workspace_id = wid
  );
$$;

-- Prove a conversation id is a widget chat conversation; return its
-- workspace id, or null when it is not (unknown id, wrong channel, or
-- no widget configured). Defined BEFORE the message policies because
-- they call it — a policy expression may only reference functions
-- that already exist. The API also uses it for its 404 checks.
create or replace function public.get_chat_conversation_workspace(
  p_conversation_id uuid
)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.workspace_id
  from public.conversations c
  where c.id = p_conversation_id
    and c.channel = 'chat'
    and public.workspace_has_widget(c.workspace_id)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- (1) anon SELECT on widget_configs (public by design)
-- ---------------------------------------------------------------------------
create policy "widget_configs_select_anon" on public.widget_configs
  for select to anon
  using (true);

-- ---------------------------------------------------------------------------
-- (2) anon INSERT on contacts, widget-configured workspaces only
-- ---------------------------------------------------------------------------
create policy "contacts_insert_widget_anon" on public.contacts
  for insert to anon
  with check (public.workspace_has_widget(workspace_id));

-- ---------------------------------------------------------------------------
-- (3) anon INSERT on conversations, chat channel only, widget workspaces only
-- ---------------------------------------------------------------------------
create policy "conversations_insert_widget_anon" on public.conversations
  for insert to anon
  with check (
    channel = 'chat'
    and public.workspace_has_widget(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- (4) anon INSERT on messages, customer/system only, widget chat only
--
-- NOTE: the parent-conversation check MUST go through the SECURITY
-- DEFINER function `get_chat_conversation_workspace` (defined below),
-- not a direct subquery on public.conversations. A direct subquery is
-- itself subject to RLS, and anon has no SELECT policy on
-- conversations, so it would always see zero rows and block every
-- legitimate insert. The function bypasses RLS for exactly this
-- narrow check.
-- ---------------------------------------------------------------------------
create policy "messages_insert_widget_anon" on public.messages
  for insert to anon
  with check (
    sender_type in ('customer', 'system')
    and public.get_chat_conversation_workspace(conversation_id) = messages.workspace_id
  );

-- ---------------------------------------------------------------------------
-- (5) anon SELECT on messages, widget chat conversations only.
-- Same SECURITY DEFINER indirection as (4) — a direct subquery on
-- conversations would see nothing under anon's RLS.
-- NOTE: internal notes (sender_type = 'system') are NOT excluded here —
-- the API layer filters them out. Do not query messages directly from a
-- public client and assume notes are hidden.
-- ---------------------------------------------------------------------------
create policy "messages_select_widget_anon" on public.messages
  for select to anon
  using (
    public.get_chat_conversation_workspace(messages.conversation_id) = messages.workspace_id
  );

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers for the public API.
-- No anon UPDATE policy on conversations exists on purpose: these
-- functions are the only way the public path mutates a conversation,
-- and each one refuses anything that is not a widget chat conversation.
-- ---------------------------------------------------------------------------

-- Dedupe lookup: the open chat conversation and/or contact for a
-- workspace + visitor email. Returns at most one row; empty when the
-- email is null/blank or nothing matches. Ids only.
create or replace function public.find_chat_context(
  p_workspace_id uuid,
  p_email text
)
returns table (conversation_id uuid, contact_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, ct.id
  from public.contacts ct
  left join public.conversations c
    on c.contact_id = ct.id
    and c.workspace_id = p_workspace_id
    and c.channel = 'chat'
    and c.status in ('open', 'pending')
  where ct.workspace_id = p_workspace_id
    and p_email is not null
    and length(btrim(p_email)) > 0
    and ct.email = lower(btrim(p_email))
  order by c.last_message_at desc nulls last, c.created_at desc nulls last
  limit 1;
$$;

-- (get_chat_conversation_workspace is defined above, before the
-- message policies, because they call it.)

-- Bump last_message_at after a visitor message is stored. Returns true
-- when a widget chat conversation was touched, false otherwise.
create or replace function public.touch_chat_conversation(
  p_conversation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.conversations c
  set last_message_at = now()
  where c.id = p_conversation_id
    and c.channel = 'chat'
    and public.workspace_has_widget(c.workspace_id);
  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

-- Flag a human handoff: priority 'high', status 'pending', plus the
-- agent-only system note. Returns true when a widget chat conversation
-- was flagged, false otherwise. The system note is visible only to
-- agents (the public messages API filters sender_type = 'system' out).
create or replace function public.request_chat_handoff(
  p_conversation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  updated_count integer;
begin
  select c.workspace_id into target_workspace_id
  from public.conversations c
  where c.id = p_conversation_id
    and c.channel = 'chat'
    and public.workspace_has_widget(c.workspace_id)
  limit 1;

  if target_workspace_id is null then
    return false;
  end if;

  update public.conversations
  set priority = 'high', status = 'pending'
  where id = p_conversation_id;
  get diagnostics updated_count = row_count;

  if updated_count > 0 then
    insert into public.messages
      (conversation_id, workspace_id, sender_type, body, language, is_ai_draft)
    values
      (p_conversation_id, target_workspace_id, 'system',
       'Visitor requested a human agent', 'en', false);
  end if;

  return updated_count > 0;
end;
$$;

-- Only anon may execute the widget helpers. (The member-only RLS
-- policies still govern every direct table access.)
revoke all on function public.workspace_has_widget(uuid) from public;
grant execute on function public.workspace_has_widget(uuid) to anon;

revoke all on function public.find_chat_context(uuid, text) from public;
grant execute on function public.find_chat_context(uuid, text) to anon;

revoke all on function public.get_chat_conversation_workspace(uuid) from public;
grant execute on function public.get_chat_conversation_workspace(uuid) to anon;

revoke all on function public.touch_chat_conversation(uuid) from public;
grant execute on function public.touch_chat_conversation(uuid) to anon;

revoke all on function public.request_chat_handoff(uuid) from public;
grant execute on function public.request_chat_handoff(uuid) to anon;
