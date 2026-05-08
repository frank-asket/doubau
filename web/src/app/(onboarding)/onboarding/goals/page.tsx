"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const options = [
  { id: "improve_cv", label: "Improve CV" },
  { id: "find_jobs", label: "Find jobs" },
  { id: "interview_prep", label: "Interview prep" },
  { id: "get_promoted", label: "Get promoted" },
  { id: "boost_linkedin", label: "Boost LinkedIn" },
];

type Profile = {
  persona?: string | null;
  goals?: { focus?: string[] } | null;
};

function defaultsForPersona(persona: string | null | undefined): string[] {
  switch (persona) {
    case "student":
      return ["find_jobs", "improve_cv", "interview_prep"];
    case "career_switcher":
      return ["improve_cv", "find_jobs"];
    case "employed_exploring":
      return ["find_jobs", "boost_linkedin"];
    case "active_search":
    default:
      return ["find_jobs"];
  }
}

export default function OnboardingGoalsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["find_jobs"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/me/profile", { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json().catch(() => ({}))) as Profile;
        if (cancelled) return;

        const existing = Array.isArray(data.goals?.focus) ? data.goals?.focus : null;
        if (existing && existing.length) {
          setSelected(existing);
          setPrefilled(true);
          return;
        }

        const defaults = defaultsForPersona(data.persona);
        setSelected(defaults);
        setPrefilled(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goals: { focus: selected },
        }),
      });
      if (!resp.ok) {
        setError("Could not save. Please try again.");
        return;
      }
      router.push("/onboarding/plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] p-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Your goals</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Pick one or more focus areas so DouBow can tailor suggestions.
        {prefilled ? (
          <span className="ml-1 text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]">
            We pre-selected a few based on your career stage.
          </span>
        ) : null}
      </p>

      <form onSubmit={onNext} className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const checked = selectedSet.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className={[
                  "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-transform active:scale-[0.96]",
                  checked
                    ? "border-[color-mix(in_srgb,var(--accent)_60%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                    : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10",
                ].join(" ")}
                aria-pressed={checked}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || selected.length === 0}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition-transform disabled:opacity-60 active:scale-[0.96]"
        >
          {loading ? "Saving…" : "Next"}
        </button>
      </form>
    </div>
  );
}

