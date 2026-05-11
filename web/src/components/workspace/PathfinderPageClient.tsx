"use client";

import Link from "next/link";

import { useWorkspaceSummary } from "@/hooks/useWorkspaceSummary";

import { WorkspaceInsightsPanel } from "./WorkspaceInsightsPanel";
import { ProductPageChrome } from "./ProductPageChrome";

const PERSONA_HINTS: Record<string, string> = {
  student:
    "Lean into internships, projects, and coursework translation — short outreach loops with alumni-heavy targets.",
  employed_exploring:
    "Optimize selective networking and passive discovery; keep approvals lightweight.",
  active_search:
    "Prioritize volume with quality gates — tracker hygiene and rapid iteration on drafts.",
  career_switcher:
    "Emphasize transferable skills in ATS optimizer runs and tailor discovery filters toward adjacent titles.",
};

export function PathfinderPageClient() {
  const q = useWorkspaceSummary();
  const persona = q.data?.persona ?? "active_search";
  const hint = PERSONA_HINTS[persona] ?? PERSONA_HINTS.active_search;

  return (
    <ProductPageChrome
      title="Career pathfinder"
      description="Persona-aware guidance grounded in your saved profile (same fields as onboarding / settings). Use this for direction, then log concrete steps on Career steps."
    >
      <div className="rounded-[var(--app-radius-lg)] border border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-bg-elevated))] px-4 py-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
        <span className="font-medium text-[var(--app-text-primary)]">Suggested next steps:</span> add milestones on{" "}
        <Link href="/app/career-steps" className="font-medium text-[var(--app-accent)] hover:underline">
          Career steps
        </Link>
        , then shortlist roles in{" "}
        <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] hover:underline">
          Job discovery
        </Link>{" "}
        and route outreach through{" "}
        <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] hover:underline">
          Approvals
        </Link>
        .
      </div>

      <WorkspaceInsightsPanel />

      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Career profile
        </div>
        {q.isLoading ? (
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">Loading…</p>
        ) : q.isError ? (
          <p className="mt-2 text-[13px] text-[var(--app-badge-red-fg)]">Could not load summary.</p>
        ) : (
          <>
            <dl className="mt-3 grid gap-2 text-[13px] text-[var(--app-text-secondary)] sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Persona</dt>
                <dd className="font-medium text-[var(--app-text-primary)]">{persona.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Current role</dt>
                <dd className="font-medium text-[var(--app-text-primary)]">{q.data?.current_role || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Location</dt>
                <dd className="font-medium text-[var(--app-text-primary)]">{q.data?.location || "—"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{hint}</p>
            <p className="mt-3 text-[12px] text-[var(--app-text-tertiary)]">
              Edit persona and role in{" "}
              <Link href="/app/settings" className="font-medium text-[var(--app-accent)] hover:underline">
                settings
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </ProductPageChrome>
  );
}
