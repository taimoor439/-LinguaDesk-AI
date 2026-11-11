/**
 * Slug helper for knowledge-base categories and articles.
 * Pure function — lower-case, ASCII, hyphen-separated. A slug that
 * ends up empty (e.g. a title of only symbols) falls back to "item".
 */
export function slugify(value: string): string {
  const slug = value
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}
