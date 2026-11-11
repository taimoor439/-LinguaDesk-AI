/**
 * Dashboard layout (server component).
 *
 * Guards every /dashboard/* page: requires Supabase config, a signed-in
 * user, and at least one workspace. The shell itself is owned by another
 * agent — this layout only supplies its props.
 */
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { getUserWorkspaces, switchWorkspace } from "@/lib/workspace";
import { getCurrentWorkspaceId } from "@/lib/db";
import SetupRequired from "@/components/SetupRequired";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces();
  if (workspaces.length === 0) {
    redirect("/onboarding");
  }

  // Cookie-aware: the workspace picked in the sidebar switcher wins
  // when the user is still a member of it; otherwise the first workspace.
  const { data: selectedWorkspaceId } = await getCurrentWorkspaceId();
  const currentWorkspaceId =
    selectedWorkspaceId ?? workspaces[0].id;

  return (
    <DashboardShell
      userEmail={user.email ?? ""}
      workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
      currentWorkspaceId={currentWorkspaceId}
      onWorkspaceSwitch={switchWorkspace}
    >
      {children}
    </DashboardShell>
  );
}
