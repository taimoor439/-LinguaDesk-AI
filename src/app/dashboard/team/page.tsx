import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getTeamMembers } from "@/lib/db";

export default async function TeamPage() {
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

  const { data: members, error } = await getTeamMembers(workspaceId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Team Members</h1>
      <p className="text-sm text-gray-500">
        Everyone with access to this workspace. Invitations arrive in Phase 2.
      </p>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-red-600">Could not load team members: {error}</p>
        </Card>
      ) : members.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="No team members yet"
            description="Members of this workspace will appear here."
          />
        </Card>
      ) : (
        <Card className="p-4">
          <ul className="divide-y divide-gray-100">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.full_name ?? member.email ?? "Unknown user"}
                  </p>
                  {member.full_name && member.email ? (
                    <p className="truncate text-sm text-gray-500">{member.email}</p>
                  ) : null}
                </div>
                <span className="ml-auto">
                  <Badge>{member.role}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
