-- ============================================================================
-- LinguaDesk AI — 0001_initial_schema
-- Plain PostgreSQL, Supabase-compatible.
--
-- RLS APPROACH
--   * Row Level Security is enabled on every table.
--   * Tenant tables (everything with a workspace_id) are visible only to
--     users who are members of that workspace, checked through the
--     SECURITY DEFINER helper `public.is_workspace_member(wid)`.
--   * The helper is SECURITY DEFINER so it bypasses RLS on
--     workspace_members itself (otherwise the membership check would
--     recurse into its own policies).
--   * `profiles` rows belong to exactly one user: a user can only
--     select/update/insert their own row (id = auth.uid()).
--   * `team_invitations` uses member-only policies in Phase 1; the
--     owner/admin role check for managing invitations is enforced in
--     the application layer and will move into RLS in a later phase.
--   * The `service_role` key bypasses RLS entirely (Supabase default),
--     so server-side admin jobs must use it deliberately and sparingly.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NOTE: the `public.is_workspace_member(wid)` helper used by the RLS
-- policies is defined below, after the workspace_members table exists:
-- a `language sql` function body is analysed at creation time, so the
-- table it queries must already exist.

-- ===========================================================================
-- profiles — one row per auth user
-- ===========================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- workspaces
-- ===========================================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_by uuid references auth.users (id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- workspace_members
-- ===========================================================================
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'agent'
    check (role in ('owner', 'admin', 'agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- ===========================================================================
-- contacts
-- ===========================================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text,
  email text,
  phone text,
  preferred_language text not null default 'en',
  channel text,
  notes text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- conversations
-- ===========================================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  channel text not null default 'chat'
    check (channel in ('email', 'chat', 'whatsapp')),
  status text not null default 'open'
    check (status in ('open', 'pending', 'resolved')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id) on delete set null,
  subject text,
  language text not null default 'en',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- messages — append-only; no updated_at by design
-- ===========================================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sender_type text not null
    check (sender_type in ('customer', 'agent', 'ai', 'system')),
  sender_id uuid,
  body text not null,
  language text,
  is_ai_draft boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- knowledge_base_categories
-- ===========================================================================
create table public.knowledge_base_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text,
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ===========================================================================
-- knowledge_base_articles
-- ===========================================================================
create table public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id uuid references public.knowledge_base_categories (id) on delete set null,
  title text,
  slug text,
  content text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ===========================================================================
-- saved_replies
-- ===========================================================================
create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text,
  body text,
  language text not null default 'en',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- team_invitations
-- ===========================================================================
create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text,
  role text not null default 'agent'
    check (role in ('admin', 'agent')),
  token text unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- widget_configs — one widget config per workspace
-- ===========================================================================
create table public.widget_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade unique,
  name text,
  welcome_message text,
  brand_color text not null default '#0D9488',
  position text not null default 'bottom-right'
    check (position in ('bottom-right', 'bottom-left')),
  collect_name boolean not null default true,
  collect_email boolean not null default true,
  greeting_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- email_accounts
-- ===========================================================================
create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null
    check (provider in ('gmail', 'microsoft')),
  email text,
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, email)
);

-- ===========================================================================
-- workspace_settings — one settings row per workspace
-- ===========================================================================
create table public.workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade unique,
  default_language text not null default 'en',
  ai_enabled boolean not null default true,
  ai_auto_draft boolean not null default true,
  data_retention_days integer not null default 365,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- audit_logs — append-only; no updated_at by design
-- ===========================================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- updated_at triggers (every table that has updated_at)
-- ===========================================================================
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.workspace_members
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.contacts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.conversations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.knowledge_base_categories
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.knowledge_base_articles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.saved_replies
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.team_invitations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.widget_configs
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.email_accounts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.workspace_settings
  for each row execute function public.handle_updated_at();

-- ===========================================================================
-- Indexes
-- ===========================================================================
create index idx_workspace_members_workspace_id on public.workspace_members (workspace_id);
create index idx_workspace_members_user_id on public.workspace_members (user_id);
create index idx_contacts_workspace_id on public.contacts (workspace_id);
create index idx_contacts_email on public.contacts (email);
create index idx_conversations_workspace_id on public.conversations (workspace_id);
create index idx_conversations_status_workspace_id on public.conversations (status, workspace_id);
create index idx_conversations_assigned_to on public.conversations (assigned_to);
create index idx_conversations_contact_id on public.conversations (contact_id);
create index idx_messages_workspace_id on public.messages (workspace_id);
create index idx_messages_conversation_id on public.messages (conversation_id);
create index idx_kb_categories_workspace_id on public.knowledge_base_categories (workspace_id);
create index idx_kb_articles_workspace_id on public.knowledge_base_articles (workspace_id);
create index idx_kb_articles_workspace_status on public.knowledge_base_articles (workspace_id, status);
create index idx_saved_replies_workspace_id on public.saved_replies (workspace_id);
create index idx_team_invitations_workspace_id on public.team_invitations (workspace_id);
create index idx_widget_configs_workspace_id on public.widget_configs (workspace_id);
create index idx_email_accounts_workspace_id on public.email_accounts (workspace_id);
create index idx_workspace_settings_workspace_id on public.workspace_settings (workspace_id);
create index idx_audit_logs_workspace_id on public.audit_logs (workspace_id);

-- ===========================================================================
-- Helper: workspace membership check (SECURITY DEFINER, bypasses RLS)
-- Defined here — after workspace_members exists — because a `language sql`
-- function body is analysed at creation time.
-- ===========================================================================
create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = wid
      and user_id = auth.uid()
  );
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.knowledge_base_categories enable row level security;
alter table public.knowledge_base_articles enable row level security;
alter table public.saved_replies enable row level security;
alter table public.team_invitations enable row level security;
alter table public.widget_configs enable row level security;
alter table public.email_accounts enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: a user may only touch their own row.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: readable/writable only by members; creatable by the creator.
create policy "workspaces_select_member" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspaces_insert_creator" on public.workspaces
  for insert with check (created_by = auth.uid());
create policy "workspaces_update_member" on public.workspaces
  for update using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));
create policy "workspaces_delete_member" on public.workspaces
  for delete using (public.is_workspace_member(id));

-- workspace_members: only members of the workspace can see/manage its roster.
create policy "workspace_members_select_member" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace_members_insert_member" on public.workspace_members
  for insert with check (public.is_workspace_member(workspace_id));
create policy "workspace_members_update_member" on public.workspace_members
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "workspace_members_delete_member" on public.workspace_members
  for delete using (public.is_workspace_member(workspace_id));

-- contacts
create policy "contacts_select_member" on public.contacts
  for select using (public.is_workspace_member(workspace_id));
create policy "contacts_insert_member" on public.contacts
  for insert with check (public.is_workspace_member(workspace_id));
create policy "contacts_update_member" on public.contacts
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "contacts_delete_member" on public.contacts
  for delete using (public.is_workspace_member(workspace_id));

-- conversations
create policy "conversations_select_member" on public.conversations
  for select using (public.is_workspace_member(workspace_id));
create policy "conversations_insert_member" on public.conversations
  for insert with check (public.is_workspace_member(workspace_id));
create policy "conversations_update_member" on public.conversations
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "conversations_delete_member" on public.conversations
  for delete using (public.is_workspace_member(workspace_id));

-- messages
create policy "messages_select_member" on public.messages
  for select using (public.is_workspace_member(workspace_id));
create policy "messages_insert_member" on public.messages
  for insert with check (public.is_workspace_member(workspace_id));
create policy "messages_update_member" on public.messages
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "messages_delete_member" on public.messages
  for delete using (public.is_workspace_member(workspace_id));

-- knowledge_base_categories
create policy "kb_categories_select_member" on public.knowledge_base_categories
  for select using (public.is_workspace_member(workspace_id));
create policy "kb_categories_insert_member" on public.knowledge_base_categories
  for insert with check (public.is_workspace_member(workspace_id));
create policy "kb_categories_update_member" on public.knowledge_base_categories
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "kb_categories_delete_member" on public.knowledge_base_categories
  for delete using (public.is_workspace_member(workspace_id));

-- knowledge_base_articles
create policy "kb_articles_select_member" on public.knowledge_base_articles
  for select using (public.is_workspace_member(workspace_id));
create policy "kb_articles_insert_member" on public.knowledge_base_articles
  for insert with check (public.is_workspace_member(workspace_id));
create policy "kb_articles_update_member" on public.knowledge_base_articles
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "kb_articles_delete_member" on public.knowledge_base_articles
  for delete using (public.is_workspace_member(workspace_id));

-- saved_replies
create policy "saved_replies_select_member" on public.saved_replies
  for select using (public.is_workspace_member(workspace_id));
create policy "saved_replies_insert_member" on public.saved_replies
  for insert with check (public.is_workspace_member(workspace_id));
create policy "saved_replies_update_member" on public.saved_replies
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "saved_replies_delete_member" on public.saved_replies
  for delete using (public.is_workspace_member(workspace_id));

-- team_invitations (member-only in Phase 1; owner/admin role check lives in
-- the app layer — see header comment).
create policy "team_invitations_select_member" on public.team_invitations
  for select using (public.is_workspace_member(workspace_id));
create policy "team_invitations_insert_member" on public.team_invitations
  for insert with check (public.is_workspace_member(workspace_id));
create policy "team_invitations_update_member" on public.team_invitations
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "team_invitations_delete_member" on public.team_invitations
  for delete using (public.is_workspace_member(workspace_id));

-- widget_configs
create policy "widget_configs_select_member" on public.widget_configs
  for select using (public.is_workspace_member(workspace_id));
create policy "widget_configs_insert_member" on public.widget_configs
  for insert with check (public.is_workspace_member(workspace_id));
create policy "widget_configs_update_member" on public.widget_configs
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "widget_configs_delete_member" on public.widget_configs
  for delete using (public.is_workspace_member(workspace_id));

-- email_accounts
create policy "email_accounts_select_member" on public.email_accounts
  for select using (public.is_workspace_member(workspace_id));
create policy "email_accounts_insert_member" on public.email_accounts
  for insert with check (public.is_workspace_member(workspace_id));
create policy "email_accounts_update_member" on public.email_accounts
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "email_accounts_delete_member" on public.email_accounts
  for delete using (public.is_workspace_member(workspace_id));

-- workspace_settings
create policy "workspace_settings_select_member" on public.workspace_settings
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace_settings_insert_member" on public.workspace_settings
  for insert with check (public.is_workspace_member(workspace_id));
create policy "workspace_settings_update_member" on public.workspace_settings
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "workspace_settings_delete_member" on public.workspace_settings
  for delete using (public.is_workspace_member(workspace_id));

-- audit_logs (read/insert for members; no update/delete policies on purpose —
-- audit history is append-only).
create policy "audit_logs_select_member" on public.audit_logs
  for select using (public.is_workspace_member(workspace_id));
create policy "audit_logs_insert_member" on public.audit_logs
  for insert with check (public.is_workspace_member(workspace_id));
