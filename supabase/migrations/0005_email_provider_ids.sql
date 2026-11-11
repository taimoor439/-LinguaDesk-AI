-- ============================================================================
-- LinguaDesk AI — 0005_email_provider_ids
--
-- Phase 5: provider ids for email dedupe, threading, and reply routing.
--
--   * conversations.provider_thread_id — the provider's thread id
--     (Gmail threadId / Graph conversationId). Sync groups messages
--     with the same thread id into one conversation.
--   * conversations.provider — which provider owns the thread
--     ('gmail' | 'microsoft'). Needed for reply routing: the reply
--     flow must know which connected account to send through, and the
--     thread id alone does not say. Nullable so rows created before
--     this migration keep working; the send path falls back to the
--     single connected account when it is null.
--   * messages.provider_message_id — the provider's message id
--     (Gmail id / Graph id). Sync dedupes on it.
--   * Partial unique index on messages (workspace_id,
--     provider_message_id) WHERE provider_message_id IS NOT NULL:
--     the same provider message can never be imported twice into one
--     workspace, while the same id in another workspace (or a NULL,
--     e.g. chat/widget messages) is unaffected. This is the DB-level
--     backstop for the application-level dedupe check in sync.
--
-- No RLS changes: the member-only policies from 0001 already cover
-- these columns (they are part of the conversations/messages tables).
--
-- STATUS: NOT applied to the live project by the agent. Run this file
-- in the Supabase SQL Editor before email sync/send can store
-- provider ids. Until then the sync action fails fast with a clear
-- "run migration 0005" message instead of crashing.
-- ============================================================================

alter table public.conversations
  add column if not exists provider_thread_id text;

alter table public.conversations
  add column if not exists provider text
  check (provider is null or provider in ('gmail', 'microsoft'));

alter table public.messages
  add column if not exists provider_message_id text;

-- Dedupe at the DB level: one provider message per workspace.
create unique index if not exists idx_messages_workspace_provider_message_id
  on public.messages (workspace_id, provider_message_id)
  where provider_message_id is not null;

-- Threading lookup used by sync (find-or-create conversation).
create index if not exists idx_conversations_provider_thread_id
  on public.conversations (workspace_id, provider_thread_id)
  where provider_thread_id is not null;
