import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getContacts } from "@/lib/db";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
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

  const query = (searchParams?.q ?? "").trim().toLowerCase();
  const { data: contacts, error } = await getContacts(workspaceId);

  const visible = query
    ? contacts.filter((c) =>
        `${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`
          .toLowerCase()
          .includes(query),
      )
    : contacts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <Link
          href="/dashboard/contacts/new"
          className="inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          New contact
        </Link>
      </div>

      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Search by name, email, or phone…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Search
        </button>
      </form>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-red-600">Could not load contacts: {error}</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="No contacts yet"
            description={
              query
                ? "No contacts match the current search."
                : "Contacts are created automatically when customers message you."
            }
          />
        </Card>
      ) : (
        <Card className="p-4">
          <ul className="divide-y divide-gray-100">
            {visible.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{contact.name ?? "Unnamed contact"}</p>
                    <p className="truncate text-sm text-gray-500">
                      {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    {contact.channel ? <Badge>{contact.channel}</Badge> : null}
                    <Badge>{contact.preferred_language}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
