import Link from "next/link";

type SetupRequiredProps = {
  /** Short heading shown on the card. */
  title?: string;
  /** Extra context, e.g. which feature needs configuration. */
  message?: string;
};

/**
 * Server-safe setup notice. Rendered by dashboard pages when Supabase
 * is not configured. Contains no client hooks and no Supabase imports.
 */
export default function SetupRequired({
  title = "Setup required",
  message = "Supabase is not configured for this app yet, so this page is unavailable. Follow the setup steps to connect a real Supabase project — no demo data is shown here.",
}: SetupRequiredProps) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center" role="status">
      <h2 className="text-lg font-bold text-navy-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
      <Link
        href="/setup"
        className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        See setup steps
      </Link>
    </div>
  );
}
