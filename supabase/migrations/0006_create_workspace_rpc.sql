-- ===========================================================================
-- 0006_create_workspace_rpc.sql
-- Workspace creation was impossible through the app (live bug 2026-11-11:
-- "new row violates row-level security policy for table 'workspaces'").
-- Two rules blocked it:
--   1. workspaces_insert_creator requires created_by = auth.uid(), but the
--      app's insert never sent created_by (NULL fails the check).
--   2. workspace_members_insert_member requires the user to ALREADY be a
--      member of the workspace — impossible for the very first member
--      (chicken-and-egg), so the owner-membership insert would fail next,
--      and even the rollback delete would fail the same way.
-- A SECURITY DEFINER function (same pattern as is_workspace_member(),
-- get_chat_conversation_workspace() and set_chat_conversation_language())
-- creates the workspace and its owner membership atomically. The function
-- itself checks auth.uid(), so it cannot be used to create a workspace
-- for anyone else. The app calls it via supabase.rpc("create_workspace").
-- ===========================================================================

create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.workspaces;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Workspace name is required.';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (btrim(p_name), p_slug, v_user_id)
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, v_user_id, 'owner');

  return v_workspace;
end;
$$;

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
