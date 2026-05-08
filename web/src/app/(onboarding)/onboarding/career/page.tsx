"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  persona?: string | null;
  current_role?: string | null;
  years_experience?: string | null;
};

const personaOptions = [
  { id: "student", label: "Student / recent graduate", hint: "New to the market, building first role momentum." },
  { id: "employed_exploring", label: "Employed, exploring", hint: "Curious and selective — not in a rush." },
  { id: "active_search", label: "Actively job searching", hint: "High intent — optimize speed and quality." },
  { id: "career_switcher", label: "Career switcher", hint: "Changing track — translate skills to a new domain." },
];

export default function OnboardingCareerPage() {
  const router = useRouter();
  const [persona, setPersona] = useState<string>("active_search");
  const [currentRole, setCurrentRole] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = useMemo(
    () =>
      "mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/me/profile", { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json().catch(() => ({}))) as Profile;
        if (cancelled) return;
        if (typeof data.persona === "string" && data.persona) setPersona(data.persona);
        if (typeof data.current_role === "string" && data.current_role) setCurrentRole(data.current_role);
        if (typeof data.years_experience === "string" && data.years_experience) setYearsExperience(data.years_experience);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          persona: persona || null,
          current_role: currentRole || null,
          years_experience: yearsExperience || null,
        }),
      });
      if (!resp.ok) {
        setError("Could not save. Please try again.");
        return;
      }
      router.push("/onboarding/contact");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] p-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Career details</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Start with one quick question so we can personalize DouBow from day one.
      </p>

      <form onSubmit={onNext} className="mt-6 space-y-4">
        <fieldset className="block">
          <legend className="text-sm font-medium">Where are you right now?</legend>
          <div className="mt-3 grid gap-3">
            {personaOptions.map((o) => {
              const checked = persona === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPersona(o.id)}
                  className={[
                    "rounded-xl border px-4 py-3 text-left transition-transform active:scale-[0.96]",
                    checked
                      ? "border-[color-mix(in_srgb,var(--accent)_60%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                      : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10",
                  ].join(" ")}
                  aria-pressed={checked}
                >
                  <div className="text-sm font-semibold">{o.label}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{o.hint}</div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="pt-2">
          <div className="text-sm font-medium">A bit more context (optional)</div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            This improves scoring and drafting quality. You can change it later.
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Current role</span>
          <input
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
            name="current_role"
            autoComplete="off"
            placeholder="e.g. Product Manager…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Years of experience</span>
          <input
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            name="years_experience"
            autoComplete="off"
            placeholder="e.g. 5–7…"
            className={inputClass}
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

