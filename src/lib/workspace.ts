"use server";

import { getUser, createClient } from "./supabase/server";

export type Role = "owner" | "admin" | "agent";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
};

/** Shape of a `workspace_members` row joined to its `workspaces` row. */
type WorkspaceMemberRow = {
  role: Role;
  workspace: Workspace | null;
};

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "workspace"}-${suffix}`;
}

/**
 * Workspaces the current user belongs to. Returns [] when Supabase is not
 * configured, when there is no signed-in user, or on any query error.
 */
export async function getUserWorkspaces(): Promise<Workspace[]> {
  try {
    const user = await getUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, slug, created_at)")
      .eq("user_id", user.id);

    if (error || !data) return [];

    const rows = data as unknown as WorkspaceMemberRow[];
    return rows
      .filter((row) => row.workspace !== null)
      .map((row) => row.workspace as Workspace);
  } catch {
    return [];
  }
}

/**
 * The workspace matching `workspaceId`, or the user's first workspace.
 * Returns null when the user has no workspaces.
 */
export async function getCurrentWorkspace(workspaceId?: string): Promise<Workspace | null> {
  const workspaces = await getUserWorkspaces();
  if (workspaces.length === 0) return null;
  if (workspaceId) {
    return workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
  }
  return workspaces[0];
}

export type CreateWorkspaceResult =
  | { data: Workspace; error: null }
  | { data: null; error: string };

/**
 * Creates a workspace owned by the current user (server action).
 * Never throws — failures are returned as `{ data: null, error }`.
 */
export async function createWorkspace(name: string): Promise<CreateWorkspaceResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { data: null, error: "Workspace name is required." };
    }

    const user = await getUser();
    if (!user) {
      return { data: null, error: "You must be signed in to create a workspace." };
    }

    const supabase = await createClient();
    const slug = generateSlug(trimmed);

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({ name: trimmed, slug })
      .select("id, name, slug, created_at")
      .single();

    if (workspaceError || !workspace) {
      return {
        data: null,
        error: workspaceError?.message ?? "Could not create the workspace.",
      };
    }

    const created = workspace as unknown as Workspace;

    const { error: memberError } = await supabase.from("workspace_members").insert({
      workspace_id: created.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      // Roll back the orphaned workspace so a half-created state is not left behind.
      await supabase.from("workspaces").delete().eq("id", created.id);
      return { data: null, error: memberError.message };
    }

    return { data: created, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Could not create the workspace.",
    };
  }
}
