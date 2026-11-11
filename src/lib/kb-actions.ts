"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace, type ActionResult } from "@/lib/actions";
import { slugify } from "@/lib/slug";

/**
 * Phase 4 server actions (Knowledge Base CRUD).
 *
 * Articles and categories are workspace-scoped and run through the
 * anon client so RLS still applies, following the actions.ts pattern.
 * Slugs are auto-generated from the title/name. Only PUBLISHED
 * articles are used for AI grounding (see getPublishedArticlesForGrounding).
 * Actions never throw — failures are returned as `{ error }`.
 */

function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ActionResult<T> {
  return { data: null, error };
}

function revalidateKb() {
  revalidatePath("/dashboard/knowledge-base");
  revalidatePath("/dashboard/ai-assistant");
}

const ARTICLE_STATUSES = ["draft", "published"] as const;

function isArticleStatus(value: string): value is (typeof ARTICLE_STATUSES)[number] {
  return (ARTICLE_STATUSES as readonly string[]).includes(value);
}

export interface KnowledgeBaseCategoryInput {
  name: string;
}

export interface KnowledgeBaseArticleInput {
  title: string;
  content: string;
  categoryId: string | null;
  status: string;
}

function validateCategoryInput(input: KnowledgeBaseCategoryInput): string | null {
  if (!input.name.trim()) return "Category name is required.";
  if (input.name.trim().length > 200) return "Category name is too long.";
  return null;
}

function validateArticleInput(input: KnowledgeBaseArticleInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (input.title.trim().length > 200) return "Title is too long.";
  if (!input.content.trim()) return "Content is required.";
  if (input.content.length > 50000) return "Content is too long (max 50,000 characters).";
  if (!isArticleStatus(input.status)) return "Status must be draft or published.";
  return null;
}

/**
 * Insert with a slug; on a slug collision within the workspace,
 * retry with a numeric suffix (title, title-2, title-3, …).
 * Returns the inserted row id, or an error message.
 */
async function insertWithUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "knowledge_base_categories" | "knowledge_base_articles",
  workspaceId: string,
  baseSlug: string,
  row: Record<string, unknown>,
): Promise<{ id: string | null; error: string | null }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from(table)
      .insert({ ...row, workspace_id: workspaceId, slug })
      .select("id")
      .single();
    if (!error && data) return { id: (data as { id: string }).id, error: null };
    if (!error) return { id: null, error: "Could not create the item." };
    // Unique-violation on (workspace_id, slug) → try the next suffix.
    if (error.code === "23505") continue;
    return { id: null, error: error.message };
  }
  return { id: null, error: "Could not find a free slug for this title. Try a different title." };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createKnowledgeBaseCategory(
  input: KnowledgeBaseCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  const validationError = validateCategoryInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const result = await insertWithUniqueSlug(
    supabase,
    "knowledge_base_categories",
    context.workspaceId,
    slugify(input.name),
    { name: input.name.trim() },
  );
  if (result.error || !result.id) return fail(result.error ?? "Could not create the category.");

  revalidateKb();
  return ok({ id: result.id });
}

export async function updateKnowledgeBaseCategory(
  categoryId: string,
  input: KnowledgeBaseCategoryInput,
): Promise<ActionResult> {
  const validationError = validateCategoryInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  // Keep the original slug stable (URLs/bookmarks); only the name changes.
  const { data, error: updateError } = await supabase
    .from("knowledge_base_categories")
    .update({ name: input.name.trim() })
    .eq("workspace_id", context.workspaceId)
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();
  if (updateError) return fail(updateError.message);
  if (!data) return fail("Category not found in this workspace.");

  revalidateKb();
  return ok(null);
}

export async function deleteKnowledgeBaseCategory(
  categoryId: string,
): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  // Articles in this category keep existing (category_id → null via
  // the schema's ON DELETE SET NULL).
  const { data, error: deleteError } = await supabase
    .from("knowledge_base_categories")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();
  if (deleteError) return fail(deleteError.message);
  if (!data) return fail("Category not found in this workspace.");

  revalidateKb();
  return ok(null);
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function createKnowledgeBaseArticle(
  input: KnowledgeBaseArticleInput,
): Promise<ActionResult<{ id: string }>> {
  const validationError = validateArticleInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  if (input.categoryId) {
    const { data: category } = await supabase
      .from("knowledge_base_categories")
      .select("id")
      .eq("workspace_id", context.workspaceId)
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!category) return fail("Category not found in this workspace.");
  }

  const result = await insertWithUniqueSlug(
    supabase,
    "knowledge_base_articles",
    context.workspaceId,
    slugify(input.title),
    {
      title: input.title.trim(),
      content: input.content.trim(),
      category_id: input.categoryId,
      status: input.status,
    },
  );
  if (result.error || !result.id) return fail(result.error ?? "Could not create the article.");

  revalidateKb();
  return ok({ id: result.id });
}

export async function updateKnowledgeBaseArticle(
  articleId: string,
  input: KnowledgeBaseArticleInput,
): Promise<ActionResult> {
  const validationError = validateArticleInput(input);
  if (validationError) return fail(validationError);

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  if (input.categoryId) {
    const { data: category } = await supabase
      .from("knowledge_base_categories")
      .select("id")
      .eq("workspace_id", context.workspaceId)
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!category) return fail("Category not found in this workspace.");
  }

  // Slug stays as first created (stable URLs); title/content/status
  // are what editing changes.
  const { data, error: updateError } = await supabase
    .from("knowledge_base_articles")
    .update({
      title: input.title.trim(),
      content: input.content.trim(),
      category_id: input.categoryId,
      status: input.status,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", articleId)
    .select("id")
    .maybeSingle();
  if (updateError) return fail(updateError.message);
  if (!data) return fail("Article not found in this workspace.");

  revalidateKb();
  return ok(null);
}

export async function deleteKnowledgeBaseArticle(
  articleId: string,
): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: deleteError } = await supabase
    .from("knowledge_base_articles")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", articleId)
    .select("id")
    .maybeSingle();
  if (deleteError) return fail(deleteError.message);
  if (!data) return fail("Article not found in this workspace.");

  revalidateKb();
  return ok(null);
}

/** Publish or unpublish one article. Only published articles ground AI drafts. */
export async function setKnowledgeBaseArticleStatus(
  articleId: string,
  status: string,
): Promise<ActionResult> {
  if (!isArticleStatus(status)) {
    return fail("Status must be draft or published.");
  }

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const supabase = await createClient();
  const { data, error: updateError } = await supabase
    .from("knowledge_base_articles")
    .update({ status })
    .eq("workspace_id", context.workspaceId)
    .eq("id", articleId)
    .select("id")
    .maybeSingle();
  if (updateError) return fail(updateError.message);
  if (!data) return fail("Article not found in this workspace.");

  revalidateKb();
  return ok(null);
}
