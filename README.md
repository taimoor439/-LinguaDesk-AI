# LinguaDesk AI

A multilingual AI customer support SaaS for small and medium-sized businesses in
Germany, Switzerland, France, and Italy. One unified dashboard for shared email
inbox, website live chat, AI-assisted replies, contacts, knowledge base, team
collaboration, and analytics — in English, Deutsch, Français, and Italiano.

> **Status: Phases 1–6 complete (implemented + verified).** The app builds and
> runs with a real database-backed architecture. Nothing here is faked: when a
> credential or service is missing, the app says so instead of pretending.
> Live AI calls and live email sync/send are **not** tested yet — they need a
> real OpenAI key and real Google/Microsoft OAuth clients (see
> [What is live-tested vs not](#what-is-live-tested-vs-not)).

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3 |
| Backend | Next.js API routes / server actions |
| Database & Auth | Supabase (PostgreSQL + Supabase Auth) |
| AI | OpenAI API (server-side only; key from `OPENAI_API_KEY`) |
| Email | Gmail API + Microsoft Graph API (OAuth) |
| Chat widget | Embeddable dependency-free JS widget served by the app |

## Folder structure

```
linguadesk-ai/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Public landing page
│   │   ├── setup/page.tsx            # "Setup required" instructions
│   │   ├── (auth)/login|signup|forgot-password/page.tsx
│   │   ├── auth/callback/route.ts    # Supabase OAuth/email callback
│   │   ├── onboarding/page.tsx       # First-run workspace creation
│   │   ├── api/
│   │   │   ├── widget.js/route.ts    # Dependency-free embeddable widget script
│   │   │   ├── widget/config/route.ts
│   │   │   ├── widget/conversations/route.ts
│   │   │   ├── widget/conversations/[id]/messages/route.ts
│   │   │   ├── widget/conversations/[id]/handoff/route.ts
│   │   │   └── email/callback/route.ts   # Gmail/Microsoft OAuth callback
│   │   └── dashboard/
│   │       ├── layout.tsx            # Auth + workspace guard + shell
│   │       ├── loading.tsx / error.tsx
│   │       └── overview|inbox|live-chat|email|contacts|ai-assistant|
│   │           knowledge-base|saved-replies|team|analytics|settings/page.tsx
│   ├── components/
│   │   ├── ui/                       # Button, Input, Card, Badge, Modal,
│   │   │                             # EmptyState, Spinner, Toast (+ index)
│   │   ├── layout/                   # Sidebar, Topbar, DashboardShell,
│   │   │                             # LanguageSelector
│   │   └── SetupRequired.tsx
│   ├── lib/
│   │   ├── supabase/                 # env, client (browser), server, middleware,
│   │   │                             # admin (narrow server-only service-role client)
│   │   ├── workspace.ts              # Workspace types + server helpers
│   │   ├── db.ts                     # Dashboard data helpers (real queries)
│   │   ├── actions.ts                # Dashboard server actions (inbox, contacts,
│   │   │                             # team, saved replies, widget config)
│   │   ├── ai-actions.ts             # AI drafts, translation, summaries
│   │   ├── kb-actions.ts             # Knowledge-base CRUD
│   │   ├── email-actions.ts          # Email connect / sync / disconnect
│   │   ├── widget-api.ts             # Public widget API helpers (anon client,
│   │   │                             # validation, rate limiting)
│   │   ├── ai/                       # detect (language), openai (server client),
│   │   │                             # grounding (KB-ranked prompts)
│   │   ├── email/                    # config, crypto (AES-256-GCM), providers
│   │   │                             # (Gmail/Graph), store, sync, send
│   │   ├── slug.ts                   # slugify (ß→ss, accents stripped)
│   │   └── i18n.ts                   # EN/DE/FR/IT dictionary + persistence
│   └── middleware.ts                 # Protects /dashboard/* and /onboarding
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql   # 14 tables, RLS (53 policies), indexes, triggers
│   │   ├── 0002_seed_demo.sql        # DEMO data only — manual, local dev only
│   │   ├── 0003_widget_public_access.sql  # Anon widget policies + RPC helpers
│   │   ├── 0004_chat_conversation_language.sql  # Conversation language setter
│   │   └── 0005_email_provider_ids.sql    # Provider thread/message ids + dedupe
│   └── seed.sql                      # Pointer to the demo seed
├── .env.example                      # All env vars (placeholders only)
├── tailwind.config.ts                # Navy + teal design tokens, Inter
└── package.json
```

## Local setup

### 1. Prerequisites

- Node.js 18+ (tested with Node 24) and npm
- A free Supabase project: https://supabase.com/dashboard

### 2. Install

```bash
cd linguadesk-ai
npm install
cp .env.example .env.local
```

### 3. Configure environment (`.env.local`)

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev; the production URL when deployed. The live-chat install snippet uses it for the widget script URL — without it the snippet is relative and only works on the same origin. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key (server only, never expose). Used only by the narrow admin client that reads profiles of proven workspace members. |
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → connection string (optional; only needed for direct Postgres access) |
| `OPENAI_API_KEY` | OpenAI Dashboard → API keys. Without it, AI features show an honest "AI is not configured" state instead of faking results. Optional: `OPENAI_MODEL` (default `gpt-4o-mini`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client (web app). Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/email/callback` — register exactly this URI in the client, and add it to `.env.local` via `NEXT_PUBLIC_APP_URL`. Without these, "Connect Gmail" is disabled with the reason shown. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Azure Portal → App registrations → OAuth client. Same redirect URI as above. Without these, "Connect Microsoft" is disabled. |
| `TOKEN_ENCRYPTION_KEY` | Generate locally (32 bytes as 64 hex chars, e.g. `openssl rand -hex 32`). Required before any email account can be connected — tokens are encrypted with AES-256-GCM and are never stored in plaintext. Without it, the connect flow refuses to store tokens. |

Without the Supabase variables the app still starts, but every protected
page shows an honest **"Setup required"** screen with instructions instead
of a fake login.

### 4. Database setup

**Supabase (recommended):**

1. In the Supabase Dashboard, open the SQL Editor.
2. Run `supabase/migrations/0001_initial_schema.sql` — creates 14 tables,
   Row Level Security policies (workspace isolation), indexes, and
   `updated_at` triggers.
3. Run `supabase/migrations/0003_widget_public_access.sql` — anon policies
   for the public chat widget (chat channel only, customer/system messages
   only; no anon SELECT on conversations/contacts, no anon UPDATE/DELETE)
   plus the SECURITY DEFINER helpers the widget API uses.
4. Run `supabase/migrations/0004_chat_conversation_language.sql` — lets the
   widget store the detected language on a chat conversation.
5. Run `supabase/migrations/0005_email_provider_ids.sql` — provider thread
   id / provider message id columns and the partial unique index that stops
   the same provider message being imported twice into one workspace.
6. Optional, local dev only: run `supabase/migrations/0002_seed_demo.sql`
   for clearly-marked demo data (Acme Support Demo). **Never run it in
   production.**

**Plain PostgreSQL:** the migrations are standard PostgreSQL (uses
`pgcrypto` for `gen_random_uuid()`). You must also create the `auth.users`
references yourself or adapt the `profiles` / `workspace_members` foreign
keys — Supabase Auth is the supported path.

### 5. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
```

First run flow: sign up → confirm email → create your workspace → dashboard.

## Website chat widget

On **Dashboard → Live Chat** the app shows the exact install snippet for the
current workspace, with a copy button:

```html
<script src="https://your-app.example.com/api/widget.js" data-workspace="<workspace-id>"></script>
```

Paste it before the closing `</body>` tag of any website. The widget shows a
launcher in the workspace's brand colour and corner, collects the visitor's
name/email (when configured), and opens a chat. The visitor's messages are
stored as `channel: 'chat'` conversations in the workspace inbox; agent
replies appear in the widget when it polls for new messages. A "Talk to a
human" button flags the conversation (priority `high`, status `pending`) and
it shows in the agent "Needs attention" list. The widget script is
dependency-free vanilla JS and contains no keys or Supabase references — it
only calls back to the app origin. The widget config (welcome message, brand
colour, position, name/email collection) is editable on the Live Chat page.

## Architecture notes

- **Multi-tenancy:** every tenant table has `workspace_id`. Row Level
  Security enforces workspace isolation at the database layer via
  `is_workspace_member()`; the app layer never relies on frontend filtering.
  All 14 tables have RLS enabled; 58 policies in total (53 from 0001 + 5
  from 0003), verified in-memory with PGlite.
- **Roles:** `owner` / `admin` / `agent` on `workspace_members`. Membership
  and role checks run in the server actions before any data access.
- **Public widget API:** the widget routes use the anon client so RLS
  applies, validate the workspace id, reject empty/overlong bodies, and
  rate-limit POSTs (30/min per IP + workspace/conversation, in-memory).
  Internal notes (`sender_type: 'system'`) and AI drafts are filtered out
  of widget message responses in code — the 0003 policy permits the row, so
  the API filter is what keeps them agent-only.
- **AI safety:** AI responses are drafts by default and always need human
  approval before sending — never auto-send, never auto-publish. Drafts are
  grounded only in the workspace's published knowledge-base articles; when
  no article matches, the draft says the knowledge base has no answer and
  recommends a human — the model never invents business facts. Approved
  drafts are saved as agent messages; they are **not** sent by email.
  The OpenAI key is read only in the server-only client
  (`src/lib/ai/openai.ts`).
- **Email safety:** provider tokens are encrypted server-side with
  AES-256-GCM (`TOKEN_ENCRYPTION_KEY`, 32 bytes as 64 hex or 44 base64
  chars). No plaintext fallback, ever. Sync is manual ("Sync now"), threads
  by provider thread id, dedupes by provider message id, skips the
  account's own sent mail, and reports honest imported/skipped counts.
  Replies are sent via the provider only when that provider is connected;
  otherwise they are saved to the thread and labelled "saved — not sent".
- **Languages:** dashboard UI labels ship in EN/DE/FR/IT (see
  `src/lib/i18n.ts`), persisted in `localStorage`. Customer messages keep
  their own language — nothing is forced into English. Incoming messages
  get a heuristic EN/DE/FR/IT detection stored on the message (and on the
  conversation once migration 0004 is applied).
- **Secrets:** `.env*` is gitignored (except `.env.example`). No secrets
  are committed. Server-only keys never reach the browser — verified by
  grepping the production build output for the service-role key.
- **Performance:** list queries carry `.limit()` (inbox 50, messages 500,
  contacts 200, KB articles 100, analytics conversations 1000); single-row
  lookups use `.maybeSingle()`/`.limit(1)`; team profile resolution is one
  batched `.in()` call, not N+1. Dashboard First Load JS is ~98–104 kB.

## Phase plan

- **Phase 1 — Foundation** ✅ Project setup, design system, Supabase auth,
  workspace structure, dashboard layout, database schema, i18n groundwork.
- **Phase 2 — Customer Support** ✅ Overview with real metrics, inbox detail
  (status/assign/reply-as-saved/internal notes), contacts CRUD, team invites
  + roles, saved replies CRUD, workspace switcher.
- **Phase 3 — Website Chat** ✅ Embeddable widget, per-workspace install
  snippet, backend messaging API, live-chat dashboard, human handoff,
  widget config. Migration `0003_widget_public_access.sql`.
- **Phase 4 — AI Features** ✅ Language detection, knowledge-base-grounded
  AI draft replies (human approval required), translation, conversation
  summaries, AI Assistant dashboard, knowledge-base CRUD. Migration
  `0004_chat_conversation_language.sql`.
- **Phase 5 — Email** ✅ Gmail + Microsoft OAuth connect flows, AES-256-GCM
  token encryption, manual sync with threading + dedupe, email dashboard,
  provider replies with saved-not-sent fallback. Migration
  `0005_email_provider_ids.sql`.
- **Phase 6 — Testing** ✅ Functional review of every flow, security review
  (RLS coverage, service-role audit, client-bundle secret check), performance
  pass, fixes, this README. Test scripts live in `/tmp` (PGlite, stub
  servers, crypto tests) and are not part of the repo.

## What is live-tested vs not

**Verified against the running production build (local):** `tsc`, lint, and
build all pass; every dashboard route returns 307 → `/login` when signed
out; `/` and `/login` return 200; the widget API returns 200/201/400/404 as
specified (bad UUID 400, unknown workspace 404, empty message 400, rate
limit 429 after 30/min); the email OAuth callback returns 400 (not a crash)
for missing code/state and for `access_denied`. PGlite suites cover the
migrations (0001+0003+0004+0005 in sequence, RLS policy counts, anon
allow/deny rules, email dedupe, KB slug behaviour). Stub-server suites cover
the Gmail/Graph sync and send paths, token refresh, and AES-256-GCM
encryption round-trips.

**NOT live-tested (needs real credentials):**

- **AI calls** — no OpenAI key exists. The not-configured UI paths are
  exercised; no live call was or could be made with a fake key. Add a real
  `OPENAI_API_KEY` and generate a draft from the inbox to test end-to-end.
- **Email connect / sync / send** — no Google/Microsoft OAuth clients and
  no test mailboxes exist. The real connect flow, token exchange, live sync,
  and live send are untested until OAuth clients are created and a mailbox
  is connected.
- **Signed-in end-to-end flows** — the live Supabase project has no users,
  workspaces, or data, so no signed-in dashboard flow (workspace creation,
  inbox actions, widget visitor→agent round-trip) has been run against the
  live project. The widget API was verified against the running app with a
  fake workspace id (404s, as specified) and in PGlite.
- **Migrations 0003–0005** have not been applied to the live Supabase
  project yet — run them in the SQL Editor (see step 4) before the widget,
  conversation language, and email-threading features work live.

## What still needs configuration

- **OpenAI API key** — add `OPENAI_API_KEY` to `.env.local` to enable AI
  drafts, translation, and summaries.
- **Google / Microsoft OAuth clients** — create them, register the redirect
  URI `{NEXT_PUBLIC_APP_URL}/api/email/callback`, and set the four
  `GOOGLE_`/`MICROSOFT_` variables plus `TOKEN_ENCRYPTION_KEY` to enable
  email connect/sync/send.
- **Migrations 0003–0005** — run in the Supabase SQL Editor (see step 4).
- **Hosting / domain** — deliberately not configured yet; deploy only after
  testing and approval, per the launch strategy.
