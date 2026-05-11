"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const tiers = [
  { id: "standard", name: "Standard", price: "£15/mo" },
  { id: "pro", name: "Pro", price: "£25/mo" },
  { id: "ultimate", name: "Ultimate", price: "£50/mo" },
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
    <div className="rounded-2xl border border-[var(--border)] p-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Choose a plan</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        You can change this later. Paid billing uses Clerk Billing from{" "}
        <span className="font-medium text-[var(--foreground)]">Billing</span> when plans are configured.
        {recommended ? (
          <span className="ml-1 text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]">
            Recommended for you: <span className="font-semibold">{recommended}</span>
            {isRecommended ? " (selected)" : ""}.
          </span>
        ) : null}
      </p>

      <form onSubmit={onFinish} className="mt-6 space-y-4">
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
                  "rounded-xl border px-4 py-3 text-left transition-transform active:scale-[0.96]",
                  checked
                    ? "border-[color-mix(in_srgb,var(--accent)_60%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                    : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10",
                ].join(" ")}
                aria-pressed={checked}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{t.name}</div>
                  {rec ? (
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_60%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground)]">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">{t.price}</div>
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
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition-transform disabled:opacity-60 active:scale-[0.96]"
        >
          {loading ? "Saving…" : "Finish onboarding"}
        </button>
      </form>
    </div>
  );
}

