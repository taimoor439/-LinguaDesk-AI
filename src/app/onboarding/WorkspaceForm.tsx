"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace } from "@/lib/workspace";

export default function WorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Please enter a workspace name (at least 2 characters).");
      return;
    }

    setLoading(true);
    try {
      const result = await createWorkspace(name.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Workspace name
        <input
          type="text"
          required
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Support"
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 font-normal outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {loading ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
