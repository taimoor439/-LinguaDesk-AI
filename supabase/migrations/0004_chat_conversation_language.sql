-- ============================================================================
-- LinguaDesk AI — 0004_chat_conversation_language
--
-- Phase 4: let the public widget API record the language of the FIRST
-- customer message on its conversation.
--
-- WHY A FUNCTION
--   The anon role has no UPDATE policy on conversations (0001/0003
--   deliberately withhold it), and the widget API must not gain one:
--   a public caller must never be able to rewrite conversation rows.
--   This SECURITY DEFINER function is the only mutation path, and it
--   is narrowly scoped:
--     * only widget chat conversations (channel = 'chat' AND the
--       workspace has a widget configured — same test as 0003's
--       get_chat_conversation_workspace),
--     * only the `language` column, only to one of en/de/fr/it,
--     * only when the conversation has exactly ONE customer message —
--       i.e. the first visitor message has just arrived. Later messages
--       never change the conversation language (the agent can correct
--       it from the dashboard; the widget must not keep flipping it).
--
-- STATUS: NOT applied to the live project by the agent. Run this file
-- in the Supabase SQL Editor (same as 0003) before the widget language
-- update takes effect. Until then the widget API still stores the
-- detected language on each message row; only the conversation-level
-- update is missing.
-- ============================================================================

-- Set the language of a widget chat conversation, but only for the
-- first customer message. Returns true when the language was updated.
create or replace function public.set_chat_conversation_language(
  p_conversation_id uuid,
  p_language text
)
returns boolean
language plpgsql
security definer
-- VOLATILE (the default): this function writes to conversations, so it
-- must NOT be marked stable like the read-only 0003 helpers.
set search_path = public
as $$
declare
  v_customer_messages int;
begin
  if p_language not in ('en', 'de', 'fr', 'it') then
    return false;
  end if;

  -- Must be a widget chat conversation (same rule as 0003).
  if public.get_chat_conversation_workspace(p_conversation_id) is null then
    return false;
  end if;

  -- Only the first customer message may set the language.
  select count(*) into v_customer_messages
  from public.messages
  where conversation_id = p_conversation_id
    and sender_type = 'customer';
  if v_customer_messages <> 1 then
    return false;
  end if;

  update public.conversations
  set language = p_language
  where id = p_conversation_id;

  return found;
end;
$$;

revoke all on function public.set_chat_conversation_language(uuid, text) from public;
grant execute on function public.set_chat_conversation_language(uuid, text) to anon;
