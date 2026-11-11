-- ============================================================================
-- DEMO DATA — DO NOT RUN IN PRODUCTION
-- ============================================================================
-- This file inserts obviously fake demo data (Demo GmbH, Max Mustermann,
-- etc.) for LOCAL DEVELOPMENT ONLY.
--
--   * Run it MANUALLY, once, against a throwaway dev Supabase project —
--     never against a production database.
--   * Run 0001_initial_schema.sql first.
--   * It deliberately does NOT create workspace_members rows: membership
--     references auth.users, so add yourself as a member of the demo
--     workspace after signing up in the dev project, e.g.
--       insert into public.workspace_members (workspace_id, user_id, role)
--       values ('11111111-1111-1111-1111-111111111111', '<your auth user id>', 'owner');
--   * All ids are fixed UUIDs and every insert uses ON CONFLICT DO NOTHING,
--     so re-running the file is safe.
-- ============================================================================

-- Demo workspace ------------------------------------------------------------
insert into public.workspaces (id, name, slug, settings)
values (
  '11111111-1111-1111-1111-111111111111',
  'Acme Support Demo',
  'acme-support-demo',
  '{"demo": true}'::jsonb
)
on conflict (id) do nothing;

-- Demo workspace settings ---------------------------------------------------
insert into public.workspace_settings
  (id, workspace_id, default_language, ai_enabled, ai_auto_draft, data_retention_days)
values (
  '21111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'en', true, true, 365
)
on conflict (workspace_id) do nothing;

-- Demo contacts (3) ---------------------------------------------------------
insert into public.contacts (id, workspace_id, name, email, phone, preferred_language, channel, notes)
values
  ('31111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Max Mustermann', 'max.mustermann@example.de', '+49 170 0000001', 'de', 'chat',
   'Demo contact — German-speaking customer.'),
  ('31111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111',
   'Marie Dupont', 'marie.dupont@example.fr', '+33 6 00 00 00 02', 'fr', 'email',
   'Demo contact — French-speaking customer.'),
  ('31111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111',
   'Giulia Rossi', 'giulia.rossi@example.it', '+39 333 0000003', 'it', 'chat',
   'Demo contact — Italian-speaking customer.')
on conflict (id) do nothing;

-- Demo conversations (3) ----------------------------------------------------
insert into public.conversations
  (id, workspace_id, contact_id, channel, status, priority, subject, language, last_message_at)
values
  ('41111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '31111111-1111-1111-1111-111111111111', 'chat', 'open', 'high',
   'Demo: Where is my order?', 'de', now()),
  ('41111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111',
   '31111111-1111-1111-1111-111111111112', 'email', 'pending', 'normal',
   'Demo: Question about my invoice', 'fr', now()),
  ('41111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111',
   '31111111-1111-1111-1111-111111111113', 'chat', 'resolved', 'low',
   'Demo: How do I change my address?', 'it', now())
on conflict (id) do nothing;

-- Demo messages (~6) --------------------------------------------------------
insert into public.messages
  (id, conversation_id, workspace_id, sender_type, body, language, is_ai_draft)
values
  ('51111111-1111-1111-1111-111111111111', '41111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'customer',
   'Hallo, wo ist meine Bestellung? (Demo message)', 'de', false),
  ('51111111-1111-1111-1111-111111111112', '41111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'ai',
   'Guten Tag! Ihre Bestellung ist unterwegs und kommt morgen an. (Demo AI draft)', 'de', true),
  ('51111111-1111-1111-1111-111111111113', '41111111-1111-1111-1111-111111111112',
   '11111111-1111-1111-1111-111111111111', 'customer',
   'Bonjour, je ne comprends pas ma facture. (Demo message)', 'fr', false),
  ('51111111-1111-1111-1111-111111111114', '41111111-1111-1111-1111-111111111112',
   '11111111-1111-1111-1111-111111111111', 'ai',
   'Bonjour ! Je peux vous expliquer votre facture en détail. (Demo AI draft)', 'fr', true),
  ('51111111-1111-1111-1111-111111111115', '41111111-1111-1111-1111-111111111113',
   '11111111-1111-1111-1111-111111111111', 'customer',
   'Come posso cambiare il mio indirizzo? (Demo message)', 'it', false),
  ('51111111-1111-1111-1111-111111111116', '41111111-1111-1111-1111-111111111113',
   '11111111-1111-1111-1111-111111111111', 'agent',
   'Puoi aggiornare il tuo indirizzo nelle impostazioni del tuo account. (Demo reply)', 'it', false)
on conflict (id) do nothing;

-- Demo knowledge base (2 articles) ------------------------------------------
insert into public.knowledge_base_categories (id, workspace_id, name, slug)
values
  ('61111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Getting Started', 'getting-started')
on conflict (workspace_id, slug) do nothing;

insert into public.knowledge_base_articles
  (id, workspace_id, category_id, title, slug, content, status)
values
  ('71111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '61111111-1111-1111-1111-111111111111',
   'Demo: How to track your order',
   'demo-how-to-track-your-order',
   'Demo article. Orders can be tracked from the confirmation email link.',
   'published'),
  ('71111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111',
   '61111111-1111-1111-1111-111111111111',
   'Demo: How to update your address',
   'demo-how-to-update-your-address',
   'Demo article. Update your address from your account settings page.',
   'draft')
on conflict (workspace_id, slug) do nothing;

-- Demo saved replies (2) ----------------------------------------------------
insert into public.saved_replies (id, workspace_id, title, body, language)
values
  ('81111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Demo: Greeting (EN)',
   'Hello! Thanks for reaching out — how can I help you today? (Demo reply)', 'en'),
  ('81111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111',
   'Demo: Greeting (DE)',
   'Guten Tag! Vielen Dank für Ihre Nachricht — wie kann ich Ihnen helfen? (Demo reply)', 'de')
on conflict (id) do nothing;

-- Demo widget config ---------------------------------------------------------
insert into public.widget_configs
  (id, workspace_id, name, welcome_message, brand_color, position, collect_name, collect_email, greeting_message)
values (
  '91111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Demo Website Widget',
  'Hi! How can we help you today? (Demo widget)',
  '#0D9488', 'bottom-right', true, true,
  'Hello! Ask us anything. (Demo greeting)'
)
on conflict (workspace_id) do nothing;
