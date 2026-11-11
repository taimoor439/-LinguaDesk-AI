"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { SidebarWorkspace } from "./Sidebar";

/** Top-bar title for each dashboard section (by URL segment). */
const SECTION_TITLES: Record<string, string> = {
  overview: "Overview",
  inbox: "Unified Inbox",
  "live-chat": "Website Live Chat",
  email: "Email",
  contacts: "Contacts",
  "ai-assistant": "AI Assistant",
  "knowledge-base": "Knowledge Base",
  "saved-replies": "Saved Replies",
  team: "Team Members",
  analytics: "Analytics",
  settings: "Settings",
};

export type DashboardShellProps = {
  children: ReactNode;
  userEmail?: string;
  workspaces: SidebarWorkspace[];
  currentWorkspaceId?: string;
  /**
   * Page title shown in the top bar. When omitted it is derived from the
   * current dashboard section (e.g. "Email" on /dashboard/email).
   */
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
  title,
  onWorkspaceSwitch,
  onCreateWorkspace,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The layout never passes a title, so derive it from the route —
  // previously the top bar always showed the "Overview" default, even
  // on pages like /dashboard/email.
  const pathname = usePathname();
  const section = pathname?.split("/")[2] ?? "";
  const resolvedTitle = title ?? SECTION_TITLES[section] ?? "Overview";

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
          title={resolvedTitle}
          userEmail={userEmail}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
