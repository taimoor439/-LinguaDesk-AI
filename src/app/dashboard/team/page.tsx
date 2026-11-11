import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getUser } from "@/lib/supabase/server";
import {
  getCurrentWorkspaceId,
  getCurrentUserRole,
  getTeamMembers,
  getTeamInvitations,
} from "@/lib/db";
import { removeTeamMember, revokeInvitation } from "@/lib/actions";
import ConfirmButton from "@/components/ConfirmButton";
import InviteMemberForm from "./InviteMemberForm";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function invitationLink(token: string | null): string | null {
  if (!token) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/accept-invite?token=${token}`;
}

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

  const [
    { data: members, error: membersError },
    { data: invitations, error: invitationsError },
    { data: myRole },
    user,
  ] = await Promise.all([
    getTeamMembers(workspaceId),
    getTeamInvitations(workspaceId),
    getCurrentUserRole(workspaceId),
    getUser(),
  ]);

  const canManage = myRole === "owner" || myRole === "admin";
  const now = Date.now();
  const pending = invitations.filter(
    (inv) => !inv.accepted_at && (!inv.expires_at || new Date(inv.expires_at).getTime() > now),
  );
  const past = invitations.filter(
    (inv) => inv.accepted_at || (inv.expires_at && new Date(inv.expires_at).getTime() <= now),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Team Members</h1>
      <p className="text-sm text-gray-500">
        Everyone with access to this workspace. Owners and admins can invite
        teammates and remove members.
      </p>

      {membersError || invitationsError ? (
        <Card className="p-4">
          <p className="text-sm text-red-600">
            Could not load team data: {membersError ?? invitationsError}
          </p>
        </Card>
      ) : null}

      {canManage ? (
        <Card className="p-4">
          <h2 className="text-lg font-medium">Invite a teammate</h2>
          <p className="mt-1 text-sm text-gray-500">
            Agents answer conversations; admins can also manage the team and
            settings. Only owners and admins can invite.
          </p>
          <div className="mt-4">
            <InviteMemberForm />
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-gray-600">
            You are an agent in this workspace. Only owners and admins can
            invite or remove teammates.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-lg font-medium">Members ({members.length})</h2>
        {members.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No team members yet"
              description="Members of this workspace will appear here."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {members.map((member) => {
              const isMe = user?.id === member.user_id;
              const displayName =
                member.full_name ?? member.email ?? member.user_id;
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {displayName}
                      {isMe ? (
                        <span className="ml-2 text-sm font-normal text-gray-500">(you)</span>
                      ) : null}
                    </p>
                    {member.full_name && member.email ? (
                      <p className="truncate text-sm text-gray-500">{member.email}</p>
                    ) : null}
                    <p className="text-xs text-gray-400">
                      Member since {formatTime(member.created_at)}
                    </p>
                  </div>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        member.role === "owner"
                          ? "success"
                          : member.role === "admin"
                            ? "info"
                            : "default"
                      }
                    >
                      {member.role}
                    </Badge>
                    {canManage && member.role !== "owner" ? (
                      <ConfirmButton
                        label="Remove"
                        confirmTitle={`Remove ${displayName}?`}
                        confirmText="They will immediately lose access to this workspace. Their past messages and notes stay in the conversations they worked on."
                        onConfirm={removeTeamMember.bind(null, member.id)}
                      />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">
          Pending invitations ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No pending invitations"
              description="Invitations you send will appear here with their link until they are accepted or expire."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {pending.map((invitation) => {
              const link = invitationLink(invitation.token);
              return (
                <li key={invitation.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invitation.email ?? "No email"}</p>
                      <p className="text-sm text-gray-500">
                        Invited as {invitation.role} · expires{" "}
                        {formatTime(invitation.expires_at)}
                      </p>
                    </div>
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      <Badge variant="warning">Pending</Badge>
                      {canManage ? (
                        <ConfirmButton
                          label="Revoke"
                          confirmTitle="Revoke this invitation?"
                          confirmText="The invitation link will stop working. You can invite the same person again later."
                          onConfirm={revokeInvitation.bind(null, invitation.id)}
                        />
                      ) : null}
                    </span>
                  </div>
                  {link ? (
                    <input
                      type="text"
                      readOnly
                      value={link}
                      aria-label={`Invitation link for ${invitation.email ?? "invitee"}`}
                      onFocus={(event) => event.target.select()}
                      className="mt-2 w-full rounded-md border border-gray-200 bg-slate-50 px-3 py-2 text-sm"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {past.length > 0 ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700">
              Accepted or expired ({past.length})
            </h3>
            <ul className="mt-2 space-y-1">
              {past.map((invitation) => (
                <li key={invitation.id} className="text-sm text-gray-500">
                  {invitation.email ?? "No email"} —{" "}
                  {invitation.accepted_at
                    ? `accepted ${formatTime(invitation.accepted_at)}`
                    : `expired ${formatTime(invitation.expires_at)}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
