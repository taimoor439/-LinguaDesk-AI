/**
 * DashboardMockup — a CSS-only product preview for the marketing homepage.
 *
 * This is a static UI mockup (sample data) showing what the LinguaDesk
 * workspace looks like: an inbox with conversations in four languages,
 * an AI-draft card awaiting human approval, and a small stats row.
 * It is NOT live data — the caption below the frame says so.
 */

const CONVERSATIONS: {
  lang: string;
  langLabel: string;
  name: string;
  snippet: string;
  channel: string;
  status: string;
  statusClass: string;
  time: string;
}[] = [
  {
    lang: "DE",
    langLabel: "Deutsch",
    name: "Lena Fischer",
    snippet: "Wann wird meine Bestellung geliefert?",
    channel: "Live chat",
    status: "Open",
    statusClass: "bg-teal-50 text-teal-700 ring-teal-600/20",
    time: "2 min",
  },
  {
    lang: "FR",
    langLabel: "Français",
    name: "Camille Dubois",
    snippet: "Je voudrais retourner un article, s'il vous plaît.",
    channel: "Email",
    status: "Pending",
    statusClass: "bg-amber-50 text-amber-700 ring-amber-600/20",
    time: "9 min",
  },
  {
    lang: "IT",
    langLabel: "Italiano",
    name: "Marco Rossi",
    snippet: "Quali sono gli orari di apertura?",
    channel: "Live chat",
    status: "Open",
    statusClass: "bg-teal-50 text-teal-700 ring-teal-600/20",
    time: "14 min",
  },
  {
    lang: "EN",
    langLabel: "English",
    name: "Sophie Meyer",
    snippet: "Thanks — the tracking link worked, all good!",
    channel: "Email",
    status: "Resolved",
    statusClass: "bg-slate-100 text-slate-600 ring-slate-500/20",
    time: "1 h",
  },
];

const SIDEBAR_ITEMS = [
  { label: "Overview", active: false },
  { label: "Unified Inbox", active: true },
  { label: "Website Live Chat", active: false },
  { label: "AI Assistant", active: false },
  { label: "Knowledge Base", active: false },
];

export default function DashboardMockup() {
  return (
    <figure aria-label="Preview of the LinguaDesk workspace inbox">
      <div className="overflow-hidden rounded-xl bg-white text-left shadow-2xl ring-1 ring-white/20">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden="true" />
          <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
            LinguaDesk — Unified Inbox
          </span>
        </div>

        <div className="flex">
          {/* Mini sidebar */}
          <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-slate-200 bg-navy-950 p-3 sm:flex">
            <span className="mb-1 flex items-center gap-2 px-2 py-1 text-xs font-bold text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-500 text-[11px] text-white">
                L
              </span>
              LinguaDesk
            </span>
            {SIDEBAR_ITEMS.map((item) => (
              <span
                key={item.label}
                className={
                  item.active
                    ? "rounded-md bg-white/10 px-2 py-1.5 text-xs font-medium text-white"
                    : "rounded-md px-2 py-1.5 text-xs text-slate-400"
                }
              >
                {item.label}
              </span>
            ))}
          </div>

          {/* Inbox list */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <span className="text-sm font-semibold text-navy-900">Unified Inbox</span>
              <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700 ring-1 ring-navy-600/10">
                4 languages
              </span>
            </div>
            <ul>
              {CONVERSATIONS.map((c) => (
                <li
                  key={c.name}
                  className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[11px] font-bold text-navy-700"
                    title={c.langLabel}
                  >
                    {c.lang}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="text-sm font-semibold text-navy-900">{c.name}</span>
                      <span className="text-[11px] text-slate-400">{c.channel}</span>
                      <span className="text-[11px] text-slate-400">· {c.time} ago</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-slate-600">
                      {c.snippet}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${c.statusClass}`}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>

            {/* AI draft card */}
            <div className="border-t border-slate-200 bg-teal-50/60 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-teal-800">
                <span aria-hidden="true">✦</span> AI draft — ready for review
              </p>
              <p className="mt-1 text-sm text-slate-700">
                „Ihre Bestellung wird innerhalb von 2–4 Werktagen geliefert.
                Den Tracking-Link erhalten Sie per E-Mail.“
              </p>
              <div className="mt-2 flex gap-2">
                <span className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white">
                  Approve
                </span>
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-navy-900 ring-1 ring-slate-300">
                  Edit
                </span>
                <span className="ml-auto self-center text-[11px] text-slate-500">
                  A human always approves before sending
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-400">
        Product preview — sample conversations, not live data.
      </figcaption>
    </figure>
  );
}
