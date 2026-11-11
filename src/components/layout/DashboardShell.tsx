"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { SidebarWorkspace } from "./Sidebar";

export type DashboardShellProps = {
  children: ReactNode;
  userEmail?: string;
  workspaces: SidebarWorkspace[];
  currentWorkspaceId?: string;
  /** Page title shown in the top bar. Defaults to "Overview". */
  title?: string;
  /** Called when the user picks another workspace in the sidebar. */
  onWorkspaceSwitch?: (workspaceId: string) => void;
  /** Called when the user picks "Create workspace" in the sidebar. */
  onCreateWorkspace?: () => void;
};

/**
 * Dashboard layout shell: fixed sidebar (drawer on mobile), top bar,
 * and a centred content column. Data arrives via props only — this
 * component makes no Supabase or workspace-lib calls.
 */
export default function DashboardShell({
  children,
  userEmail,
  workspaces,
  currentWorkspaceId,
  title = "Overview",
  onWorkspaceSwitch,
  onCreateWorkspace,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        workspaces={workspaces}
        currentId={currentWorkspaceId}
        onSwitch={onWorkspaceSwitch}
        onCreateWorkspace={onCreateWorkspace}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:pl-64">
        <Topbar
          title={title}
          userEmail={userEmail}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
