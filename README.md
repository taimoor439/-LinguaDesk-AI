# LinguaDesk AI

A multilingual AI customer support SaaS for small and medium-sized businesses in
Germany, Switzerland, France, and Italy. One unified dashboard for shared email
inbox, website live chat, AI-assisted replies, contacts, knowledge base, team
collaboration, and analytics — in English, Deutsch, Français, and Italiano.

> **Status: Phase 1 (Foundation) complete.** The app runs locally with a real
> database-backed architecture. Later phases add the inbox depth, live-chat
> widget, AI features, and email integrations. Nothing here is faked: when a
> credential or service is missing, the app says so instead of pretending.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3 |
| Backend | Next.js API routes / server actions (later phases) |
| Database & Auth | Supabase (PostgreSQL + Supabase Auth) |
| AI | OpenAI API (Phase 4; server-side only) |
| Email | Gmail API + Microsoft Graph API (Phase 5; OAuth) |
| Chat widget | Embeddable JS widget (Phase 3) |

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
│   │   ├── supabase/                 # env, client (browser), server, middleware
│   │   ├── workspace.ts              # Workspace types + server helpers
│   │   ├── db.ts                     # Dashboard data helpers (real queries)
│   │   └── i18n.ts                   # EN/DE/FR/IT dictionary + persistence
│   └── middleware.ts                 # Protects /dashboard/* and /onboarding
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql   # 14 tables, RLS, indexes, triggers
│   │   └── 0002_seed_demo.sql        # DEMO data only — manual, local dev only
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
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key (server only, never expose) |
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → connection string (optional; only needed for direct Postgres access) |
| `OPENAI_API_KEY` | Phase 4 — leave empty until then |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Phase 5 (Gmail OAuth) — leave empty until then |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Phase 5 (Outlook OAuth) — leave empty until then |

Without the Supabase variables the app still starts, but every protected
page shows an honest **"Setup required"** screen with instructions instead
of a fake login.

### 4. Database setup

**Supabase (recommended):**

1. In the Supabase Dashboard, open the SQL Editor.
2. Run `supabase/migrations/0001_initial_schema.sql` — creates 14 tables,
   Row Level Security policies (workspace isolation), indexes, and
   `updated_at` triggers.
3. Optional, local dev only: run `supabase/migrations/0002_seed_demo.sql`
   for clearly-marked demo data (Acme Support Demo). **Never run it in
   production.**

**Plain PostgreSQL:** the migration is standard PostgreSQL (uses
`pgcrypto` for `gen_random_uuid()`). You must also create the `auth.users`
references yourself or adapt the `profiles` / `workspace_members` foreign
keys — Supabase Auth is the supported path for Phase 1.

### 5. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
```

First run flow: sign up → confirm email → create your workspace → dashboard.

## Architecture notes

- **Multi-tenancy:** every tenant table has `workspace_id`. Row Level
  Security enforces workspace isolation at the database layer via
  `is_workspace_member()`; the app layer never relies on frontend filtering.
- **Roles:** `owner` / `admin` / `agent` on `workspace_members`. Phase 1
  enforces membership; fine-grained role checks land with team management
  in Phase 2.
- **AI safety:** AI responses are drafts by default and always need human
  approval before sending (Phase 4). The AI must never invent company
  facts; if the knowledge base has no answer, it recommends a human.
- **Languages:** dashboard UI labels ship in EN/DE/FR/IT (see
  `src/lib/i18n.ts`), persisted in `localStorage`. Customer messages keep
  their own language — nothing is forced into English.
- **Secrets:** `.env*` is gitignored (except `.env.example`). No secrets
  are committed. Server-only keys never reach the browser.

## Phase plan

- **Phase 1 — Foundation** ✅ Project setup, design system, Supabase auth,
  workspace structure, dashboard layout, database schema, i18n groundwork.
- **Phase 2 — Customer Support:** unified inbox depth, contacts, conversation
  assignment, team invitations, saved replies management.
- **Phase 3 — Website Chat:** embeddable widget, per-workspace install
  snippet, backend messaging API, live-chat dashboard, human handoff.
- **Phase 4 — AI Features:** OpenAI integration, language detection,
  translation, knowledge-base-grounded drafts, conversation summaries.
- **Phase 5 — Email:** Gmail + Microsoft OAuth, sync, threading, replies.
- **Phase 6 — Testing:** functional + security review, fixes, performance,
  production build.

## What still needs configuration

- **Supabase project** (URL + anon key + service role key) — required for
  auth and all data. Without it, pages show the setup screen.
- **OpenAI API key** — Phase 4.
- **Google / Microsoft OAuth clients** — Phase 5.
- **Hosting / domain** — deliberately not configured yet; deploy only after
  testing and approval, per the launch strategy.
