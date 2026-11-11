"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { inviteTeamMember } from "@/lib/actions";

/**
 * Invite a teammate by email. Creates a team_invitations row and shows
 * the invitation link to the inviter — no email is sent yet (invitations
 * are accepted in a later phase).
 */
export default function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ inviteLink: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setInvite(null);
    setCopied(false);
    const result = await inviteTeamMember(email, role);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setInvite(result.data);
      setEmail("");
    }
  };

  const copyLink = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.inviteLink);
      setCopied(true);
    } catch {
      // Clipboard unavailable — the link is selectable below.
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-slate-700">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" loading={saving}>
          Send invitation
        </Button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {invite ? (
        <div role="status" className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-900">
            Invitation created for {invite.email}.
          </p>
          <p className="mt-1 text-sm text-teal-800">
            No email was sent yet. Share this link with the invitee — it expires
            in 7 days. Accepting invitations arrives in a later phase.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readOnly
              value={invite.inviteLink}
              aria-label="Invitation link"
              onFocus={(event) => event.target.select()}
              className="w-full flex-1 rounded-md border border-teal-300 bg-white px-3 py-2 text-sm"
            />
            <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
