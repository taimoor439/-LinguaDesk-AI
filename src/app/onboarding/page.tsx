/**
 * Onboarding — first step after sign-up: create a workspace.
 *
 * Server component: redirects to /login when signed out, and to /dashboard
 * when the user already belongs to a workspace.
 */
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { getUserWorkspaces } from "@/lib/workspace";
import SetupRequired from "@/components/SetupRequired";
import WorkspaceForm from "./WorkspaceForm";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces();
  if (workspaces.length > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-neutral-900">
        <h1 className="text-2xl font-semibold">Create your workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          A workspace is your team’s home in LinguaDesk AI. It holds your
          inboxes, teammates, and AI settings — for example one workspace per
          company or per support team. You’ll be its owner and can invite
          teammates later.
        </p>
        <WorkspaceForm />
      </div>
    </main>
  );
}
