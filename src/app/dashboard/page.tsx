import { redirect } from "next/navigation";

/**
 * /dashboard has no page of its own — the dashboard home is
 * /dashboard/overview. Redirect so signed-in users (and bookmarks
 * pointing at /dashboard) never land on a 404.
 */
export default function DashboardPage() {
  redirect("/dashboard/overview");
}
