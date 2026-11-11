import Link from "next/link";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  // Treat the documented placeholder values as unconfigured.
  if (url.includes("your-project-ref") || key.includes("your-supabase-anon-key")) {
    return false;
  }
  return true;
}

const FEATURES: { title: string; description: string }[] = [
  {
    title: "One inbox for every channel",
    description:
      "Website live chat and email land in a single shared inbox, so no customer message is missed and every reply stays in context.",
  },
  {
    title: "Truly multilingual",
    description:
      "Built for teams serving Germany, Switzerland, France and Italy — the workspace speaks English, Deutsch, Français and Italiano.",
  },
  {
    title: "AI-assisted replies",
    description:
      "Draft answers in the customer's language, grounded in your own knowledge base, with a human always in control before sending.",
  },
  {
    title: "Knowledge base & saved replies",
    description:
      "Keep answers consistent across the team with a shared knowledge base and one-click saved replies for the questions you get every day.",
  },
  {
    title: "Team-ready from day one",
    description:
      "Workspaces, roles and assignment keep conversations owned, and analytics show response times and volume at a glance.",
  },
  {
    title: "Embeddable website widget",
    description:
      "Add live chat to any website with a small embed snippet and start talking to visitors where they already are.",
  },
];

const LANGUAGES = ["English", "Deutsch", "Français", "Italiano"];
const REGIONS = ["Germany", "Switzerland", "France", "Italy"];

export default function LandingPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="LinguaDesk AI home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-lg font-bold text-white" aria-hidden="true">
              L
            </span>
            <span className="text-lg font-bold text-navy-900">
              LinguaDesk <span className="text-teal-600">AI</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-navy-900 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {!configured && (
          <div className="border-b border-amber-200 bg-amber-50" role="status">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 text-sm text-amber-900 sm:px-6 lg:px-8">
              <span className="font-semibold">Setup required:</span>
              <span>
                Supabase is not configured yet, so sign-in is unavailable.
              </span>
              <Link href="/setup" className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800">
                See setup steps
              </Link>
            </div>
          </div>
        )}

        <section className="bg-navy-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
              {REGIONS.join(" · ")}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
              Customer support that speaks your customers&apos; language.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-300">
              LinguaDesk AI brings live chat, email and AI-assisted replies
              into one multilingual workspace — in {LANGUAGES.join(", ")} — so
              small teams can support customers across Europe without switching
              tools.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-teal-500 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-teal-600 focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-600 px-6 py-3 text-base font-medium text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Available in English, Deutsch, Français and Italiano.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-bold text-navy-900 sm:text-3xl">
            Everything your support team needs, in one place
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="card p-6">
                <h3 className="text-base font-semibold text-navy-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div>
              <h2 className="text-xl font-bold text-navy-900">
                Ready to answer every customer, in their language?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Create a workspace and invite your team — it takes a few minutes.
              </p>
            </div>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">
          <span>
            LinguaDesk <span className="text-teal-600">AI</span> — Multilingual AI customer support.
          </span>
          <span>English · Deutsch · Français · Italiano</span>
        </div>
      </footer>
    </div>
  );
}
