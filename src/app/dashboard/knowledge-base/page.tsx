import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getKnowledgeBaseArticles,
  getKnowledgeBaseCategories,
} from "@/lib/db";

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
        Article editing arrives in Phase 4.
      </p>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Categories</h2>
        {categories.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No categories yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category.id}>{category.name ?? category.slug ?? "Unnamed"}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Articles</h2>
        {articles.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No articles yet"
              description="Create your first article — article editing arrives in Phase 4."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {articles.map((article) => (
              <li key={article.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{article.title ?? "Untitled article"}</p>
                  <p className="truncate text-sm text-gray-500">
                    {article.knowledge_base_categories?.name ?? "No category"}
                    {article.slug ? ` · /${article.slug}` : ""}
                  </p>
                </div>
                <span className="ml-auto">
                  <Badge>{article.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
