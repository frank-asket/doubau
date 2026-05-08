"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingContactPage() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [contactPreferences, setContactPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: location || null,
          contact_preferences: contactPreferences || null,
        }),
      });
      if (!resp.ok) {
        setError("Could not save. Please try again.");
        return;
      }
      router.push("/onboarding/resume");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] p-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Contact + location</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        We use this to tailor job discovery and outreach defaults.
      </p>

      <form onSubmit={onNext} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            name="location"
            autoComplete="off"
            placeholder="e.g. London, UK…"
            className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Contact preferences</span>
          <input
            value={contactPreferences}
            onChange={(e) => setContactPreferences(e.target.value)}
            name="contact_preferences"
            autoComplete="off"
            placeholder="e.g. Email only, no LinkedIn…"
            className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
        </label>

        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition-transform disabled:opacity-60 active:scale-[0.96]"
        >
          {loading ? "Saving…" : "Next"}
        </button>
      </form>
    </div>
  );
}

