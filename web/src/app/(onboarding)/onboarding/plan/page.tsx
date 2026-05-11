"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { OnboardingStepFrame } from "@/components/onboarding/OnboardingStepFrame";

const tiers = [
  { id: "standard", name: "Standard", price: "£15/mo", detail: "Core coaching and profile support." },
  { id: "pro", name: "Pro", price: "£25/mo", detail: "More drafting, matching, and workflow capacity." },
  { id: "ultimate", name: "Ultimate", price: "£50/mo", detail: "Priority processing and advanced analytics." },
];

type Profile = {
  persona?: string | null;
  plan_tier?: string | null;
};

function recommendedTier(persona: string | null | undefined): string {
  switch (persona) {
    case "student":
      return "standard";
    case "employed_exploring":
      return "standard";
    case "career_switcher":
      return "pro";
    case "active_search":
    default:
      return "pro";
  }
}

export default function OnboardingPlanPage() {
  const router = useRouter();
  const [tier, setTier] = useState<string>("pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<string | null>(null);

  const isRecommended = useMemo(() => recommended === tier, [recommended, tier]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/me/profile", { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json().catch(() => ({}))) as Profile;
        if (cancelled) return;

        if (typeof data.plan_tier === "string" && data.plan_tier) {
          setTier(data.plan_tier);
          setRecommended(recommendedTier(data.persona));
          return;
        }

        const rec = recommendedTier(data.persona);
        setRecommended(rec);
        setTier(rec);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFinish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_tier: tier }),
      });
      if (!resp.ok) {
        setError("Could not save. Please try again.");
        return;
      }
      router.replace("/app/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingStepFrame
      eyebrow="Workspace plan"
      title="Pick the level that fits your search."
      description={
        recommended
          ? `You can change this later. Recommended for your setup: ${recommended}${isRecommended ? " (selected)" : ""}.`
          : "You can change this later from Billing."
      }
      stepLabel="Step 5 of 5"
    >
      <form onSubmit={onFinish} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => {
            const checked = tier === t.id;
            const rec = recommended === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                className={[
                  "min-h-32 rounded-[var(--app-radius-md)] border-[0.5px] px-4 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]",
                  checked
                    ? "border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-bg-elevated))]"
                    : "border-[var(--app-border)] hover:bg-[var(--app-bg-muted)]",
                ].join(" ")}
                aria-pressed={checked}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">{t.name}</div>
                  {rec ? (
                    <span className="rounded-[var(--app-radius-pill)] border border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--app-text-primary)]">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-[20px] font-semibold tracking-tight text-[var(--app-text-primary)]">{t.price}</div>
                <div className="mt-2 text-[12px] leading-5 text-[var(--app-text-secondary)]">{t.detail}</div>
              </button>
            );
          })}
        </div>

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
        {loading ? "Saving…" : "Finish onboarding"}
        </button>
      </form>
    </OnboardingStepFrame>
  );
}
