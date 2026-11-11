#!/usr/bin/env node
/**
 * Auto-reply tests — run with: node scripts/test-auto-reply.mjs
 *
 * What it covers (no live database, no live AI calls, no secrets):
 *   1. Gating: maybeAutoReply() returns { replied: false, reason:
 *      "ai-not-configured" } when no AI key is in the environment —
 *      and touches no database to do so.
 *   2. Grounding reuse: rankArticlesForGrounding() ranks the JuicedSEO
 *      seed articles (a "local seo" question matches the services
 *      article; gibberish matches nothing).
 *   3. Migration 0007 (PGlite, optional): the ai_auto_reply column is
 *      added boolean NOT NULL DEFAULT false — auto-reply is off by
 *      default, including for rows that already exist.
 *   4. Seed SQL (PGlite, optional): seed-juicedseo-kb.sql inserts 6
 *      published articles and is idempotent on re-run.
 *   5. Wiring (static): the widget POST route calls maybeAutoReply
 *      with a 12s cap and still returns 201.
 *
 * The TypeScript sources are compiled with the project's own tsc into
 * a temp dir (no new dependency). The PGlite sections need
 * @electric-sql/pglite present in node_modules (dev-only; it is NOT a
 * runtime dependency and is NOT in package.json — if it is missing
 * those sections are skipped with a clear note instead of failing).
 */

import { execSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function skip(name, reason) {
  skipped += 1;
  console.log(`  skip ${name} (${reason})`);
}

// ---------------------------------------------------------------------------
// Compile the touched TS modules with the project's tsc.
// ---------------------------------------------------------------------------
console.log("Compiling TS sources…");
const outDir = mkdtempSync(join(tmpdir(), "auto-reply-test-"));
// Let the compiled files in /tmp resolve bare packages (e.g.
// @supabase/supabase-js) from the project's node_modules.
symlinkSync(join(ROOT, "node_modules"), join(outDir, "node_modules"), "dir");
const tsconfigPath = join(outDir, "tsconfig.json");
writeFileSync(
  tsconfigPath,
  JSON.stringify({
    // Self-contained: do NOT extend the project tsconfig — it pulls in
    // .next/types, which breaks a files-restricted compile (TS6059).
    compilerOptions: {
      outDir: join(outDir, "out"),
      rootDir: join(ROOT, "src"),
      baseUrl: ROOT,
      paths: { "@/*": ["src/*"] },
      module: "commonjs",
      target: "es2020",
      moduleResolution: "node",
      esModuleInterop: true,
      skipLibCheck: true,
      strict: true,
      types: ["node"],
      typeRoots: [join(ROOT, "node_modules/@types")],
      declaration: false,
      sourceMap: false,
    },
    files: [
      join(ROOT, "src/lib/ai/grounding.ts"),
      join(ROOT, "src/lib/ai/openai.ts"),
      join(ROOT, "src/lib/ai/auto-reply.ts"),
    ],
  }),
);
execSync(`npx tsc -p ${tsconfigPath}`, { cwd: ROOT, stdio: "pipe" });

// tsc does not rewrite the "@/..." path alias at runtime, so rewrite
// the emitted requires to paths relative to the temp out dir.
{
  const outRoot = join(outDir, "out");
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".js")) {
        const rel = relative(dirname(p), outRoot) || ".";
        const prefix = rel === "." ? "./" : `${rel.replace(/\\/g, "/")}/`;
        writeFileSync(
          p,
          readFileSync(p, "utf8").replace(
            /require\("@\//g,
            `require("${prefix}`,
          ),
        );
      }
    }
  };
  walk(outRoot);
}

// No AI keys in this process: the gating tests must see "not configured".
for (const key of ["GEMINI_API_KEY", "OPENAI_API_KEY", "AI_PROVIDER"]) {
  delete process.env[key];
}
// Never let the test process touch a real Supabase project.
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[key];
}

const compiled = (p) => require(join(outDir, "out", p));
const { rankArticlesForGrounding } = compiled("lib/ai/grounding.js");
const { isAiConfigured } = compiled("lib/ai/openai.js");
const { maybeAutoReply } = compiled("lib/ai/auto-reply.js");

// ---------------------------------------------------------------------------
// 1. Gating — AI unconfigured.
// ---------------------------------------------------------------------------
console.log("\n1. Gating (no AI key in env)");
check("isAiConfigured() is false with no keys", isAiConfigured() === false);
const gated = await maybeAutoReply({
  workspaceId: "00000000-0000-0000-0000-000000000000",
  conversationId: "00000000-0000-0000-0000-000000000000",
  customerMessage: "Hello, can you help me with local SEO?",
  language: "en",
});
check(
  "maybeAutoReply() skips when AI is unconfigured",
  gated.replied === false && gated.reason === "ai-not-configured",
  JSON.stringify(gated),
);

// ---------------------------------------------------------------------------
// 2. Grounding reuse — JuicedSEO seed articles.
// ---------------------------------------------------------------------------
console.log("\n2. Grounding reuse (seed articles)");
const seedSql = readFileSync(join(ROOT, "seed-juicedseo-kb.sql"), "utf8");
// Pull the article titles out of the seed for the ranking check.
const seedTitles = [...seedSql.matchAll(/'([A-Za-z][^']*?)',\s*\n\s*'([a-z0-9-]+)',/g)].map(
  (m) => ({ title: m[1], slug: m[2] }),
);
const seedArticles = seedTitles.map((t, i) => ({
  id: `seed-${i}`,
  title: t.title,
  slug: t.slug,
  // Content is not parsed here; the ranking test below uses titles
  // plus a synthetic services body so the overlap is exercised.
  content:
    t.slug === "seo-services"
      ? "Local SEO Google Business Profile optimisation technical SEO on-page SEO link building SEO audit ecommerce SEO enterprise SEO"
      : t.slug === "packages-and-pricing"
        ? "Starter Growth Enterprise packages Custom Pricing month-to-month no lock-in contracts"
        : t.slug === "contact-juicedseo"
          ? "phone email Sydney NSW Australia business hours Monday Friday 9am 5pm AEST"
          : t.slug === "about-juicedseo"
            ? "local SEO agency Australian businesses 150 businesses ranked white-hat"
            : t.slug === "how-it-works"
              ? "audit discovery strategy planning implementation reporting growth free strategy call"
              : "free consultation getting started cost pricing quote",
}));
check("seed has 6 articles", seedTitles.length === 6, `got ${seedTitles.length}`);

const rankedServices = rankArticlesForGrounding(
  "what SEO services do you offer?",
  seedArticles,
  3,
);
check(
  "services question ranks the services article first",
  rankedServices.length > 0 && rankedServices[0].slug === "seo-services",
  JSON.stringify(rankedServices.map((r) => r.slug)),
);
const rankedLocalSeo = rankArticlesForGrounding(
  "anyone here can help me about local seo?",
  seedArticles,
  3,
);
check(
  "local-seo question matches the services article (top 3)",
  rankedLocalSeo.some((r) => r.slug === "seo-services"),
  JSON.stringify(rankedLocalSeo.map((r) => r.slug)),
);
check(
  "gibberish matches no article",
  rankArticlesForGrounding("xqzwkj bvnmm zzzzz", seedArticles, 3).length === 0,
);

// Greeting detection + sharp auto-reply prompt (no dead-end replies).
const { isGreetingMessage, buildAutoReplyPrompt } = compiled(
  "lib/ai/grounding.js",
);
check("isGreetingMessage('hi')", isGreetingMessage("hi") === true);
check("isGreetingMessage('?')", isGreetingMessage("?") === true);
check("isGreetingMessage('salam')", isGreetingMessage("salam") === true);
check(
  "isGreetingMessage('I want to know about local seo') is false",
  isGreetingMessage("I want to know about local seo") === false,
);
check(
  "substring ranking: 'seo' matches the JuicedSEO title",
  rankArticlesForGrounding(
    "seo",
    [{ id: "x", title: "About JuicedSEO", slug: "about-x", content: "We are an agency." }],
    3,
  ).length === 1,
);
const aboutArticle = seedArticles.find((a) => a.slug === "about-juicedseo");
const greetingPrompt = buildAutoReplyPrompt(
  "en",
  [{ sender_type: "customer", body: "hi" }],
  [],
  { greeting: true, businessOverview: aboutArticle },
);
check(
  "greeting prompt welcomes instead of dead-ending",
  greetingPrompt.system.includes("Welcome them warmly") &&
    !greetingPrompt.system.includes("has no answer") &&
    greetingPrompt.user.includes("local SEO agency"),
);
const noMatchPrompt = buildAutoReplyPrompt(
  "en",
  [{ sender_type: "customer", body: "do you do PPC?" }],
  [],
  { greeting: false, businessOverview: aboutArticle },
);
check(
  "no-match prompt never says 'no information'",
  noMatchPrompt.system.includes("Do NOT say the knowledge base has no information") &&
    !noMatchPrompt.system.includes("say plainly that the knowledge base has no answer"),
);
const matchedPrompt = buildAutoReplyPrompt(
  "en",
  [{ sender_type: "customer", body: "what SEO services do you offer?" }],
  rankedServices,
  { greeting: false },
);
check(
  "matched prompt answers directly from excerpts",
  matchedPrompt.system.includes("Answer the visitor's question directly"),
);

// ---------------------------------------------------------------------------
// 3 + 4. PGlite: migration 0007 + seed SQL (optional — see header).
// ---------------------------------------------------------------------------
console.log("\n3. Migration 0007 + seed SQL (PGlite)");
let PGlite = null;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  skip("PGlite sections", "@electric-sql/pglite not installed in node_modules");
}

if (PGlite) {
  const db = new PGlite();
  try {
    // Minimal stubs matching the 0001 table shapes the seed/migration need.
    await db.exec(`
      create table public.widget_configs (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null unique,
        name text,
        brand_color text not null default '#0D9488'
      );
      create table public.knowledge_base_articles (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null,
        title text,
        slug text,
        content text,
        status text not null default 'draft',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (workspace_id, slug)
      );
      insert into public.widget_configs (workspace_id) values ('fc16b1ed-c656-4527-9c05-ebbd34531183');
    `);
    const migration = readFileSync(
      join(ROOT, "supabase/migrations/0007_widget_ai_auto_reply.sql"),
      "utf8",
    );
    await db.exec(migration);

    const col = await db.query(`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'widget_configs'
        and column_name = 'ai_auto_reply'
    `);
    check("migration adds ai_auto_reply column", col.rows.length === 1);
    if (col.rows.length === 1) {
      const c = col.rows[0];
      check("ai_auto_reply is boolean", c.data_type === "boolean", c.data_type);
      check("ai_auto_reply is NOT NULL", c.is_nullable === "NO", c.is_nullable);
      check(
        "ai_auto_reply defaults to false (off by default)",
        c.column_default === "false",
        String(c.column_default),
      );
    }
    const existing = await db.query(
      `select ai_auto_reply from public.widget_configs where workspace_id = 'fc16b1ed-c656-4527-9c05-ebbd34531183'`,
    );
    check(
      "pre-existing row gets false",
      existing.rows.length === 1 && existing.rows[0].ai_auto_reply === false,
      JSON.stringify(existing.rows),
    );
    // Re-running the migration must not fail (IF NOT EXISTS).
    await db.exec(migration);
    check("migration is idempotent on re-run", true);

    await db.exec(seedSql);
    const kb = await db.query(
      `select slug, status from public.knowledge_base_articles order by slug`,
    );
    check("seed inserts 6 published articles", kb.rows.length === 6, `got ${kb.rows.length}`);
    check(
      "all seed articles are published",
      kb.rows.every((r) => r.status === "published"),
    );
    await db.exec(seedSql);
    const kb2 = await db.query(`select count(*)::int as n from public.knowledge_base_articles`);
    check("seed is idempotent on re-run", kb2.rows[0].n === 6, `got ${kb2.rows[0].n}`);
  } finally {
    await db.close();
  }
}

// ---------------------------------------------------------------------------
// 5. Wiring (static): widget POST route.
// ---------------------------------------------------------------------------
console.log("\n5. Wiring (static source check)");
const routeSrc = readFileSync(
  join(ROOT, "src/app/api/widget/conversations/[id]/messages/route.ts"),
  "utf8",
);
check("POST route imports maybeAutoReply", routeSrc.includes("maybeAutoReply"));
check("POST route caps auto-reply at 12s", routeSrc.includes("12_000"));
check(
  "POST route still returns 201 after the auto-reply attempt",
  routeSrc.includes('return jsonResponse({ message: data }, 201);'),
);
const createRouteSrc = readFileSync(
  join(ROOT, "src/app/api/widget/conversations/route.ts"),
  "utf8",
);
check(
  "conversation-creation route also auto-replies (first message)",
  createRouteSrc.includes("maybeAutoReply") &&
    createRouteSrc.includes("runAutoReply(existingId)") &&
    createRouteSrc.includes("runAutoReply(conversationId)"),
);
const configRouteSrc = readFileSync(
  join(ROOT, "src/app/api/widget/config/route.ts"),
  "utf8",
);
check(
  "public widget config does NOT expose ai_auto_reply",
  !configRouteSrc.includes("ai_auto_reply"),
);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
