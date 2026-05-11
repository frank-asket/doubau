import type { Metadata } from "next";
import Link from "next/link";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import { JobPipelineHint } from "@/components/app/JobPipelineHint";
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

type ApplicationOut = {
  id: string;
  company: string;
  job_title: string;
  status: string;
  source_url?: string | null;
};

type DraftOut = {
  id: string;
  application_id: string;
  channel: string;
  content: string;
};

type WorkspaceSummary = {
  resume_status?: string | null;
  applications_total?: number;
  applications_by_status?: Record<string, number>;
  pending_approval_count?: number;
};

function resumeReadinessPct(status: string | null | undefined): number {
  switch (status) {
    case "EMBEDDED":
      return 100;
    case "PARSED":
      return 72;
    case "UPLOADED":
      return 40;
    case "FAILED":
      return 12;
    default:
      return 0;
  }
}

function pipelineMomentumPct(by: Record<string, number> | undefined, total: number): number {
  if (!total || !by) return 0;
  const sub = by.SUBMITTED ?? 0;
  return Math.min(100, Math.round((sub / total) * 100));
}

function discoveryTouchPct(by: Record<string, number> | undefined): number {
  if (!by) return 0;
  const imp = by.impression ?? 0;
  const clk = by.click_out ?? 0;
  const score = imp + clk * 2;
  return Math.min(100, Math.round((score / 30) * 100));
}

export default async function DashboardPage() {
  let profile: Profile = {};
  let workspaceSummary: WorkspaceSummary | null = null;
  let matchMetrics: { by_event_type?: Record<string, number> } | null = null;
  let pendingCard: {
    title: string;
    subtitle: string;
    snippet: string;
  } | null = null;

  try {
    const base = getApiBaseUrl();
    const headers = await getBackendAuthHeaders();
    const profileRes = await fetch(`${base}/me/profile`, {
      headers,
      cache: "no-store",
    });

    profile = profileRes.ok
      ? ((await profileRes.json().catch(() => ({}))) as Profile)
      : {};

    const [appsRes, draftsRes, wsRes, mmRes] = await Promise.all([
      fetch(`${base}/applications`, { headers, cache: "no-store" }),
      fetch(`${base}/applications/drafts`, { headers, cache: "no-store" }),
      fetch(`${base}/me/workspace-summary`, { headers, cache: "no-store" }),
      fetch(`${base}/me/match/metrics?days=14`, { headers, cache: "no-store" }),
    ]);
    if (wsRes.ok) {
      workspaceSummary = (await wsRes.json().catch(() => null)) as WorkspaceSummary | null;
    }
    if (mmRes.ok) {
      matchMetrics = (await mmRes.json().catch(() => null)) as { by_event_type?: Record<string, number> } | null;
    }
    if (appsRes.ok && draftsRes.ok) {
      const apps = (await appsRes.json()) as ApplicationOut[];
      const drafts = (await draftsRes.json()) as DraftOut[];
      const appById = new Map(apps.map((a) => [a.id, a]));
      const hit = drafts.find((d) => appById.get(d.application_id)?.status === "PENDING_APPROVAL");
      if (hit) {
        const app = appById.get(hit.application_id);
        if (app) {
          const ch = hit.channel ? hit.channel.charAt(0).toUpperCase() + hit.channel.slice(1) : "Draft";
          let subtitle = `${ch} · ${app.company}`;
          if (app.source_url) {
            try {
              subtitle = `${ch} · ${new URL(app.source_url).hostname}`;
            } catch {
              /* ignore */
            }
          }
          const raw = hit.content.trim();
          const snippet = raw.length > 320 ? `${raw.slice(0, 320)}…` : raw;
          pendingCard = {
            title: `${app.job_title} — ${app.company}`,
            subtitle,
            snippet,
          };
        }
      }
    }
  } catch {
    /* Clerk auth failure or API unreachable (e.g. NEXT_PUBLIC_API_BASE_URL unset → localhost on Vercel). */
  }

  const focus = Array.isArray(profile.goals?.focus) ? profile.goals?.focus : [];

  const resumePct = resumeReadinessPct(workspaceSummary?.resume_status);
  const pipePct = pipelineMomentumPct(
    workspaceSummary?.applications_by_status,
    workspaceSummary?.applications_total ?? 0,
  );
  const discPct = discoveryTouchPct(matchMetrics?.by_event_type);

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
        <p className="mt-2 max-w-2xl text-pretty text-[12px] leading-relaxed text-[var(--app-text-tertiary)]">
          Core MVP loop: discover roles → open a posting → generate outreach → approve before anything sends.
        </p>
        <div className="mt-4 max-w-2xl">
          <JobPipelineHint variant="dashboard" />
        </div>
      </div>

      {profile.email &&
      (!profile.plan_tier ||
        !["ultimate", "Ultimate"].includes(String(profile.plan_tier))) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-badge-blue-bg)] px-4 py-3 text-[13px] text-[#0C447C]">
          <span>
            {profile.plan_tier ? (
              <>
                You are on <strong>{String(profile.plan_tier)}</strong>. Compare Standard, Pro, and Ultimate when billing is
                connected in Clerk.
              </>
            ) : (
              <>Pick a plan when you are ready — Standard, Pro, or Ultimate — from billing (Clerk).</>
            )}
          </span>
          <Link
            href="/app/billing"
            className="shrink-0 rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--app-accent-hover)]"
          >
            View plans
          </Link>
        </div>
      ) : null}

      <div className="grid gap-[var(--app-space-lg)] lg:grid-cols-3">
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Account signals
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
            Derived from your résumé status, application pipeline, and discovery events — not placeholder demo scores.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <AppProgress label="Résumé readiness (indexing)" tone="success" value={resumePct} />
            <AppProgress
              label="Pipeline momentum (% submitted)"
              tone="warning"
              value={pipePct}
            />
            <AppProgress label="Discovery activity (14d)" tone="info" value={discPct} />
          </div>
        </div>

        <div className="lg:col-span-2">
          {pendingCard ? (
            <AppApprovalCard
              actionsSlot={
                <Link
                  href="/app/approvals"
                  className="inline-flex cursor-pointer items-center justify-center rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-3 py-1 text-[12px] font-medium leading-5 text-white transition-colors hover:bg-[var(--app-accent-hover)]"
                >
                  Open approval dashboard
                </Link>
              }
              badgeLabel="Pending"
              badgeVariant="amber"
              snippet={pendingCard.snippet}
              subtitle={pendingCard.subtitle}
              title={pendingCard.title}
            />
          ) : (
            <AppApprovalCard
              badgeLabel="Queue"
              badgeVariant="gray"
              snippet="When an outreach draft is waiting for your review, the excerpt appears here. Generate drafts from applications in your tracker or approval dashboard."
              subtitle="Human-in-the-loop"
              title="No pending outreach in queue"
            />
          )}
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
              Go to <span className="font-semibold text-[var(--app-text-primary)]">Discovery</span> and shortlist roles.
            </li>
            <li>
              Generate outreach from a role, then approve in{" "}
              <Link className="font-semibold text-[var(--app-accent)] hover:underline" href="/app/approvals">
                Approvals
              </Link>
              .
            </li>
            <li>Ask Copilot for a 7-day sprint plan tailored to your persona.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

