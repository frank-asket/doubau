import type { Metadata } from "next";

import { DashboardResumePanel } from "@/components/resume/DashboardResumePanel";
import { AppApprovalCard } from "@/components/ui/approval-card";
import { AppBadge } from "@/components/ui/badge";
import { AppProgress } from "@/components/ui/progress";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

type Profile = {
  email?: string;
  persona?: string | null;
  goals?: { focus?: string[] } | null;
  plan_tier?: string | null;
};

function personaLabel(persona: string | null | undefined): string {
  switch (persona) {
    case "student":
      return "Student / recent graduate";
    case "employed_exploring":
      return "Employed, exploring";
    case "active_search":
      return "Actively job searching";
    case "career_switcher":
      return "Career switcher";
    default:
      return "Career stage not set";
  }
}

function goalLabel(id: string): string {
  switch (id) {
    case "improve_cv":
      return "Improve CV";
    case "find_jobs":
      return "Find jobs";
    case "interview_prep":
      return "Interview prep";
    case "get_promoted":
      return "Get promoted";
    case "boost_linkedin":
      return "Boost LinkedIn";
    default:
      return id;
  }
}

export default async function DashboardPage() {
  const profile = await fetch("/api/me/profile", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Profile>) : ({} as Profile)))
    .catch(() => ({} as Profile));

  const focus = Array.isArray(profile.goals?.focus) ? profile.goals?.focus : [];

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          {profile.email ? (
            <>
              Signed in as <span className="font-semibold text-[var(--app-text-primary)]">{profile.email}</span> ·{" "}
              <span className="font-semibold text-[var(--app-text-primary)]">{personaLabel(profile.persona)}</span>
              {profile.plan_tier ? (
                <>
                  {" "}
                  · Plan:{" "}
                  <span className="font-semibold text-[var(--app-text-primary)]">{profile.plan_tier}</span>
                </>
              ) : null}
            </>
          ) : (
            "Personalizing your workspace…"
          )}
        </p>
      </div>

      <div className="grid gap-[var(--app-space-lg)] lg:grid-cols-3">
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Signals
          </div>
          <div className="mt-3 flex flex-col gap-3">
            <AppProgress label="Skills mastery" tone="success" value={75} />
            <AppProgress label="Interview success" tone="warning" value={42} />
            <AppProgress label="CV score" tone="info" value={88} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <AppApprovalCard
            badgeLabel="Pending"
            badgeVariant="amber"
            snippet="Hi Sarah, I came across the Senior PM role at Google and was immediately drawn to the focus on cross-functional delivery…"
            subtitle="LinkedIn · 2 mins ago"
            title="Senior PM — Google"
          />
        </div>
      </div>

      <DashboardResumePanel />

      <div className="grid gap-[var(--app-space-lg)] lg:grid-cols-2">
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div className="text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">Your focus</div>
          <p className="mt-1 text-[14px] leading-6 text-[var(--app-text-secondary)]">
            These defaults come from your career stage — you can edit them in onboarding anytime.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {focus.length ? (
              focus.map((g) => (
                <AppBadge key={g} variant="gray">
                  {goalLabel(g)}
                </AppBadge>
              ))
            ) : (
              <span className="text-[13px] text-[var(--app-text-secondary)]">No goals selected yet.</span>
            )}
          </div>
        </div>

        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div className="text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
            Recommended next steps
          </div>
          <ul className="mt-4 space-y-2 text-[13px] text-[var(--app-text-secondary)]">
            <li>
              Go to <span className="font-semibold text-[var(--app-text-primary)]">Job Discovery</span> and save 10 roles.
            </li>
            <li>
              Generate an outreach draft and approve it in{" "}
              <span className="font-semibold text-[var(--app-text-primary)]">Approvals</span>.
            </li>
            <li>Ask Copilot for a 7-day sprint plan tailored to your persona.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

