import Link from "next/link";

const STEPS: { title: string; detail: string }[] = [
  {
    title: "Create a Supabase project",
    detail:
      "Go to supabase.com/dashboard, create a new project, and wait for it to finish provisioning.",
  },
  {
    title: "Copy the project URL and anon key",
    detail:
      "In the Supabase dashboard, open Settings → API and copy the Project URL and the anon / public key.",
  },
  {
    title: "Add them to .env.local",
    detail:
      "In the project root, copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the values you copied. Never commit .env.local.",
  },
  {
    title: "Restart the dev server",
    detail:
      "Stop and restart `npm run dev` so Next.js picks up the new environment variables, then return to the home page.",
  },
];

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="card p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
            LinguaDesk AI
          </p>
          <h1 className="mt-2 text-2xl font-bold text-navy-900">Setup required</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            LinguaDesk AI needs a Supabase project for authentication and data
            storage. The app is not configured yet, so sign-in, workspaces and
            the dashboard are unavailable until the steps below are complete.
            Nothing here is demo data — set up a real project to continue.
          </p>

          <ol className="mt-8 space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-navy-900">{step.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-navy-900">Variables to set in .env.local</h2>
            <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-slate-700">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key`}
            </pre>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Back to home
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy-900 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Try sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
