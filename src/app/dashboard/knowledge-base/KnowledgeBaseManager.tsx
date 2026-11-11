"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Input } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";
import {
  createKnowledgeBaseCategory,
  updateKnowledgeBaseCategory,
  deleteKnowledgeBaseCategory,
  createKnowledgeBaseArticle,
  updateKnowledgeBaseArticle,
  deleteKnowledgeBaseArticle,
  setKnowledgeBaseArticleStatus,
} from "@/lib/kb-actions";

export interface CategoryData {
  id: string;
  name: string | null;
  slug: string | null;
}

export interface ArticleData {
  id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/**
 * Full knowledge-base management: categories and articles with
 * create/edit/delete and publish/unpublish. Slugs are auto-generated
 * from the title/name on the server. Only PUBLISHED articles are used
 * to ground AI drafts.
 */
export default function KnowledgeBaseManager({
  articles,
  categories,
}: {
  articles: ArticleData[];
  categories: CategoryData[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const [articleFormOpen, setArticleFormOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [articleCategoryId, setArticleCategoryId] = useState("");
  const [articleStatus, setArticleStatus] = useState("draft");

  const refresh = () => router.refresh();

  const openNewCategory = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryFormOpen(true);
  };

  const openEditCategory = (category: CategoryData) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name ?? "");
    setCategoryFormOpen(true);
  };

  const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const result = editingCategoryId
      ? await updateKnowledgeBaseCategory(editingCategoryId, { name: categoryName })
      : await createKnowledgeBaseCategory({ name: categoryName });
    if (result.error) {
      setError(result.error);
      return;
    }
    setCategoryFormOpen(false);
    refresh();
  };

  const openNewArticle = () => {
    setEditingArticleId(null);
    setArticleTitle("");
    setArticleContent("");
    setArticleCategoryId("");
    setArticleStatus("draft");
    setArticleFormOpen(true);
  };

  const openEditArticle = (article: ArticleData) => {
    setEditingArticleId(article.id);
    setArticleTitle(article.title ?? "");
    setArticleContent(article.content ?? "");
    setArticleCategoryId(article.categoryId ?? "");
    setArticleStatus(article.status);
    setArticleFormOpen(true);
  };

  const handleArticleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const input = {
      title: articleTitle,
      content: articleContent,
      categoryId: articleCategoryId || null,
      status: articleStatus,
    };
    const result = editingArticleId
      ? await updateKnowledgeBaseArticle(editingArticleId, input)
      : await createKnowledgeBaseArticle(input);
    if (result.error) {
      setError(result.error);
      return;
    }
    setArticleFormOpen(false);
    refresh();
  };

  const toggleStatus = async (article: ArticleData) => {
    setBusyId(article.id);
    setError(null);
    const result = await setKnowledgeBaseArticleStatus(
      article.id,
      article.status === "published" ? "draft" : "published",
    );
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-6">
      <ErrorNote message={error} />

      {/* Categories */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Categories</h2>
          <Button size="sm" variant="secondary" onClick={openNewCategory}>
            New category
          </Button>
        </div>
        {categoryFormOpen ? (
          <form onSubmit={handleCategorySubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              label="Category name"
              name="category-name"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="e.g. Shipping"
              required
            />
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">
                {editingCategoryId ? "Save" : "Create"}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setCategoryFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        {categories.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No categories yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{category.name ?? "Unnamed"}</span>
                <span className="text-sm text-gray-500">
                  {category.slug ? `/${category.slug}` : ""}
                </span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEditCategory(category)}>
                    Edit
                  </Button>
                  <ConfirmButton
                    label="Delete"
                    confirmTitle="Delete this category?"
                    confirmText="Articles in this category will keep existing, without a category."
                    onConfirm={() => deleteKnowledgeBaseCategory(category.id)}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Articles */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Articles</h2>
          <Button size="sm" onClick={openNewArticle}>
            New article
          </Button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Only published articles are used to ground AI drafts. Draft
          articles are never fed to the AI.
        </p>

        {articleFormOpen ? (
          <form onSubmit={handleArticleSubmit} className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Input
              label="Title"
              name="article-title"
              value={articleTitle}
              onChange={(event) => setArticleTitle(event.target.value)}
              placeholder="e.g. How long does delivery take?"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="article-category" className="mb-1 block text-sm font-medium text-slate-700">
                  Category
                </label>
                <select
                  id="article-category"
                  value={articleCategoryId}
                  onChange={(event) => setArticleCategoryId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name ?? category.slug ?? "Unnamed"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="article-status" className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  id="article-status"
                  value={articleStatus}
                  onChange={(event) => setArticleStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="article-content" className="mb-1 block text-sm font-medium text-slate-700">
                Content
              </label>
              <textarea
                id="article-content"
                value={articleContent}
                onChange={(event) => setArticleContent(event.target.value)}
                placeholder="Write the answer the AI should use, in plain language…"
                rows={8}
                required
                maxLength={50000}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                The slug is generated from the title automatically.
              </p>
            </div>
            <ErrorNote message={error} />
            <div className="flex gap-2">
              <Button type="submit">{editingArticleId ? "Save changes" : "Create article"}</Button>
              <Button type="button" variant="secondary" onClick={() => setArticleFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {articles.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No articles yet. Create your first article — publish it so the
            AI assistant can use it when drafting replies.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {articles.map((article) => (
              <li key={article.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{article.title ?? "Untitled article"}</p>
                    <p className="truncate text-sm text-gray-500">
                      {article.categoryName ?? "No category"}
                      {article.slug ? ` · /${article.slug}` : ""}
                    </p>
                  </div>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <Badge variant={article.status === "published" ? "success" : "default"}>
                      {article.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleStatus(article)}
                      loading={busyId === article.id}
                    >
                      {article.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditArticle(article)}>
                      Edit
                    </Button>
                    <ConfirmButton
                      label="Delete"
                      confirmTitle="Delete this article?"
                      confirmText="The article will be removed from the knowledge base and will no longer ground AI drafts."
                      onConfirm={() => deleteKnowledgeBaseArticle(article.id)}
                    />
                  </span>
                </div>
                {article.content ? (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{article.content}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
