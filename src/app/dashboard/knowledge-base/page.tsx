import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getKnowledgeBaseArticles,
  getKnowledgeBaseCategories,
} from "@/lib/db";
import KnowledgeBaseManager from "./KnowledgeBaseManager";

export default async function KnowledgeBasePage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const { data: workspaceId } = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return (
      <EmptyState
        title="No workspace yet"
        description="You are not a member of any workspace yet."
      />
    );
  }

  const [{ data: articles }, { data: categories }] = await Promise.all([
    getKnowledgeBaseArticles(workspaceId),
    getKnowledgeBaseCategories(workspaceId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Knowledge Base</h1>
      <p className="text-sm text-gray-500">
        Articles the AI assistant uses to answer customers accurately.
        Only published articles ground AI drafts — draft articles are
        never fed to the AI.
      </p>

      <KnowledgeBaseManager
        articles={articles.map((article) => ({
          id: article.id,
          title: article.title,
          slug: article.slug,
          content: article.content,
          status: article.status,
          categoryId: article.category_id,
          categoryName: article.knowledge_base_categories?.name ?? null,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
        }))}
      />
    </div>
  );
}
