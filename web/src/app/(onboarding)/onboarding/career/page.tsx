"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { OnboardingStepFrame } from "@/components/onboarding/OnboardingStepFrame";

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
      "mt-2 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-transparent px-3 text-[14px] text-[var(--app-text-primary)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
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
    <OnboardingStepFrame
      eyebrow="Career setup"
      title="Tell us where you are in your search."
      description="This sets your default matching, drafting tone, and first dashboard recommendations."
      stepLabel="Step 1 of 5"
    >
      <form onSubmit={onNext} className="space-y-4">
        <fieldset className="block">
          <legend className="text-[13px] font-medium text-[var(--app-text-primary)]">Current situation</legend>
          <div className="mt-3 grid gap-3">
            {personaOptions.map((o) => {
              const checked = persona === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPersona(o.id)}
                  className={[
                    "rounded-[var(--app-radius-md)] border-[0.5px] px-4 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]",
                    checked
                      ? "border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-bg-elevated))]"
                      : "border-[var(--app-border)] hover:bg-[var(--app-bg-muted)]",
                  ].join(" ")}
                  aria-pressed={checked}
                >
                  <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">{o.label}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--app-text-secondary)]">{o.hint}</div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="pt-2">
          <div className="text-[13px] font-medium text-[var(--app-text-primary)]">A bit more context</div>
          <p className="mt-1 text-[12px] leading-5 text-[var(--app-text-secondary)]">
            This improves scoring and drafting quality. You can change it later.
          </p>
        </div>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--app-text-primary)]">Current role</span>
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
          <span className="text-[13px] font-medium text-[var(--app-text-primary)]">Years of experience</span>
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
          <div className="rounded-[var(--app-radius-md)] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-[var(--app-radius-md)] bg-[var(--app-accent)] text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-accent-hover)] disabled:opacity-60 active:scale-[0.96]"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </OnboardingStepFrame>
  );
}
