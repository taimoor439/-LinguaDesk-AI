-- ===========================================================================
-- 0007_widget_ai_auto_reply
-- ===========================================================================
-- Per-workspace opt-in for AI auto-reply on the website chat widget.
--
-- When widget_configs.ai_auto_reply is true, the widget message endpoint
-- lets the AI answer a new visitor message automatically, grounded in
-- that workspace's published Knowledge Base articles. Off by default:
-- existing workspaces keep the old behaviour (a human replies, or an
-- AI draft is generated only on demand from the dashboard).
--
-- Apply in the Supabase SQL Editor. The app code tolerates the column
-- being absent (auto-reply stays off; the dashboard save retries
-- without the column), so the deploy and this migration may land in
-- either order.
-- ===========================================================================

alter table public.widget_configs
  add column if not exists ai_auto_reply boolean not null default false;
