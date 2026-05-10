import type { Metadata } from "next";
import Link from "next/link";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
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

export default async function DashboardPage() {
  const base = getApiBaseUrl();
  const headers = await getBackendAuthHeaders();
  const profileRes = await fetch(`${base}/me/profile`, {
    headers,
    cache: "no-store",
  });

  const profile: Profile = profileRes.ok
    ? ((await profileRes.json().catch(() => ({}))) as Profile)
    : {};

  const focus = Array.isArray(profile.goals?.focus) ? profile.goals?.focus : [];

  let pendingCard: {
    title: string;
    subtitle: string;
    snippet: string;
  } | null = null;

  try {
    const [appsRes, draftsRes] = await Promise.all([
      fetch(`${base}/applications`, { headers, cache: "no-store" }),
      fetch(`${base}/applications/drafts`, { headers, cache: "no-store" }),
    ]);
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
    pendingCard = null;
  }

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
              snippet="When a draft is awaiting HITL review, the full text surfaces here. Create a demo from the approval dashboard to see the live card."
              subtitle="Tip"
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
              Go to <span className="font-semibold text-[var(--app-text-primary)]">Job Discovery</span> and save 10 roles.
            </li>
            <li>
              Generate an outreach draft and approve it in the{" "}
              <Link className="font-semibold text-[var(--app-accent)] hover:underline" href="/app/approvals">
                approval dashboard
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

