import type { Metadata } from "next";
import Link from "next/link";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import { ChromeIconLink, ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

type DashboardTrendPoint = {
  label: string;
  discovered: number;
  pending: number;
  submitted: number;
  failed: number;
};

type RecentApplication = {
  id: string;
  company: string;
  job_title: string;
  status: string;
  source_url?: string | null;
  updated_at?: string;
};

type DashboardSummary = {
  email?: string;
  persona?: string | null;
  current_role?: string | null;
  location?: string | null;
  plan_tier?: string | null;
  resume_status?: string | null;
  resume_readiness?: number;
  applications_total?: number;
  applications_by_status?: Record<string, number>;
  pending_approval_count?: number;
  applications_trend?: DashboardTrendPoint[];
  recent_applications?: RecentApplication[];
};

type FeedJob = {
  job: {
    id: string;
    company: string;
    title: string;
    location: string | null;
    seniority: string | null;
    employment_type: string | null;
    source_url: string | null;
  };
  score: number;
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: "Discovered",
  SCORING: "Scoring",
  DRAFTED: "Drafted",
  PENDING_APPROVAL: "Review",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
  FAILED: "Failed",
  RETRY: "Retry",
};

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function formatUpdated(iso: string | undefined) {
  if (!iso) return "No activity";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No activity";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function KpiCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  href?: string;
}) {
  const body = (
    <article className="dashboard-card rounded-[20px] border border-[var(--app-border)] bg-white/90 p-5 shadow-[var(--app-shadow-0)]">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{label}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <strong className="tabular-nums text-[34px] font-black leading-none tracking-[-0.045em] text-[var(--app-text-primary)]">
          {value}
        </strong>
        {href ? <AppIcon name="chevron-right" className="size-5 text-[var(--app-accent-700)]" /> : null}
      </div>
      <p className="mt-4 min-h-10 text-[13px] leading-5 text-[var(--app-text-secondary)]">{detail}</p>
    </article>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function ResumeReadiness({ value, status }: { value: number; status?: string | null }) {
  return (
    <section className="dashboard-card rounded-[24px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-0)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-black tracking-[-0.02em]">Profile readiness</h2>
          <p className="mt-1 text-[13px] text-[var(--app-text-secondary)]">
            Resume parsing and embedding status used by job matching.
          </p>
        </div>
        <span className="rounded-full bg-[var(--app-bg-muted)] px-3 py-1 text-[12px] font-bold text-[var(--app-text-secondary)]">
          {status || "Not uploaded"}
        </span>
      </div>
      <div className="mt-7">
        <div className="flex items-center justify-between text-[13px] font-bold">
          <span>Readiness</span>
          <span>{value}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
          <span
            className="dashboard-meter block h-full rounded-full bg-[var(--app-accent)]"
            style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function PipelineBreakdown({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const statuses = ["DISCOVERED", "DRAFTED", "PENDING_APPROVAL", "APPROVED", "SUBMITTED", "FAILED"];
  return (
    <section className="dashboard-card rounded-[24px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-0)]">
      <h2 className="text-[18px] font-black tracking-[-0.02em]">Pipeline breakdown</h2>
      <div className="mt-5 space-y-4">
        {statuses.map((status) => {
          const count = byStatus[status] ?? 0;
          return (
            <div key={status}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-bold text-[var(--app-text-primary)]">{statusLabel(status)}</span>
                <span className="tabular-nums text-[var(--app-text-secondary)]">{count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
                <span
                  className="dashboard-meter block h-full rounded-full bg-[var(--app-sidebar)]"
                  style={{ width: `${pct(count, total)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ApplicationsChart({ points }: { points: DashboardTrendPoint[] }) {
  const max = Math.max(
    1,
    ...points.map((p) => p.discovered + p.pending + p.submitted + p.failed),
  );
  const hasActivity = points.some((p) => p.discovered + p.pending + p.submitted + p.failed > 0);

  return (
    <section className="dashboard-card rounded-[28px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-1)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-black tracking-[-0.03em]">Application activity</h2>
          <p className="mt-1 text-[13px] text-[var(--app-text-secondary)]">
            Last 31 days, grouped into four-day windows.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px] font-bold text-[var(--app-text-secondary)]">
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#111612]" />Discovered</span>
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#6ea2f5]" />Review</span>
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[var(--app-accent)]" />Submitted</span>
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[var(--app-danger)]" />Failed</span>
        </div>
      </div>

      {hasActivity ? (
        <div className="relative mt-8">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[228px] rounded-2xl"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0, transparent 55px, rgba(17,22,18,0.06) 56px, transparent 57px)",
            }}
          />
          <div className="grid h-[280px] grid-cols-8 items-end gap-4">
            {points.map((point, index) => {
              const total = point.discovered + point.pending + point.submitted + point.failed;
              const scale = total ? Math.max(10, Math.round((total / max) * 100)) : 2;
              return (
                <div key={point.label} className="relative z-10 flex h-full flex-col justify-end gap-3">
                  <div className="flex flex-1 items-end justify-center px-2 pb-2">
                    <div
                      className="dashboard-stack flex w-full max-w-16 flex-col justify-end overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(17,22,18,0.06)]"
                      style={{ height: `${scale}%`, animationDelay: `${index * 45}ms` }}
                      title={`${total} applications`}
                    >
                      <span className="block bg-[var(--app-danger)]" style={{ height: `${pct(point.failed, total)}%` }} />
                      <span className="block bg-[var(--app-accent)]" style={{ height: `${pct(point.submitted, total)}%` }} />
                      <span className="block bg-[#6ea2f5]" style={{ height: `${pct(point.pending, total)}%` }} />
                      <span className="block bg-[#111612]" style={{ height: `${pct(point.discovered, total)}%` }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="tabular-nums text-[12px] font-black text-[var(--app-text-primary)]">{total}</p>
                    <p className="mt-1 rounded-full bg-[var(--app-bg-muted)] px-2 py-1 text-[11px] font-bold text-[var(--app-text-secondary)]">
                      {point.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-8 flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] px-6 text-center">
          <p className="max-w-sm text-[13px] leading-6 text-[var(--app-text-secondary)]">
            No application activity in the last 31 days. Once roles enter the tracker, this chart will use the saved
            application events.
          </p>
        </div>
      )}
    </section>
  );
}

function RecentApplications({ applications }: { applications: RecentApplication[] }) {
  return (
    <section className="dashboard-card rounded-[24px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-0)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-black tracking-[-0.02em]">Recent applications</h2>
        <Link className="text-[13px] font-bold text-[var(--app-accent-700)]" href="/app/tracker">
          View tracker
        </Link>
      </div>
      <div className="mt-5 divide-y divide-[var(--app-border)]">
        {applications.length ? (
          applications.map((app) => (
            <div key={app.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-black text-[var(--app-text-primary)]">{app.job_title}</p>
                <p className="mt-1 truncate text-[13px] text-[var(--app-text-secondary)]">{app.company}</p>
              </div>
              <div className="text-right">
                <p className="rounded-full bg-[var(--app-bg-muted)] px-3 py-1 text-[11px] font-bold text-[var(--app-text-secondary)]">
                  {statusLabel(app.status)}
                </p>
                <p className="mt-2 text-[11px] text-[var(--app-text-tertiary)]">{formatUpdated(app.updated_at)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-[13px] leading-6 text-[var(--app-text-secondary)]">
            No applications have been tracked yet. Save a role from Job Discovery to start the pipeline.
          </p>
        )}
      </div>
    </section>
  );
}

function RecommendedRoles({ jobs }: { jobs: FeedJob[] }) {
  return (
    <section className="dashboard-card rounded-[24px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-0)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-black tracking-[-0.02em]">Recommended roles</h2>
        <Link className="text-[13px] font-bold text-[var(--app-accent-700)]" href="/app/discovery">
          Open discovery
        </Link>
      </div>
      <div className="mt-5 divide-y divide-[var(--app-border)]">
        {jobs.length ? (
          jobs.slice(0, 3).map((row) => (
            <div key={row.job.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black text-[var(--app-text-primary)]">{row.job.title}</p>
                  <p className="mt-1 truncate text-[13px] text-[var(--app-text-secondary)]">{row.job.company}</p>
                </div>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--app-accent)_12%,white)] px-3 py-1 text-[11px] font-black text-[var(--app-accent-700)]">
                  {Math.round(row.score)}%
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-[13px] leading-6 text-[var(--app-text-secondary)]">
            Recommendations will appear after jobs are ingested and your resume is indexed.
          </p>
        )}
      </div>
    </section>
  );
}

async function loadDashboardData() {
  const base = getApiBaseUrl();
  const headers = await getBackendAuthHeaders();
  const [summaryRes, feedRes] = await Promise.all([
    fetch(`${base}/me/dashboard-summary`, { headers, cache: "no-store" }),
    fetch(`${base}/jobs/feed?limit=3`, { headers, cache: "no-store" }),
  ]);

  return {
    summary: summaryRes.ok ? ((await summaryRes.json().catch(() => null)) as DashboardSummary | null) : null,
    jobs: feedRes.ok ? ((await feedRes.json().catch(() => [])) as FeedJob[]) : [],
  };
}

export default async function DashboardPage() {
  let summary: DashboardSummary | null = null;
  let jobs: FeedJob[] = [];

  try {
    const data = await loadDashboardData();
    summary = data.summary;
    jobs = data.jobs;
  } catch {
    summary = null;
    jobs = [];
  }

  const byStatus = summary?.applications_by_status ?? {};
  const total = summary?.applications_total ?? 0;
  const pending = summary?.pending_approval_count ?? 0;
  const submitted = byStatus.SUBMITTED ?? 0;
  const trend =
    summary?.applications_trend?.length
      ? summary.applications_trend
      : ["1-4", "5-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-31"].map((label) => ({
          label,
          discovered: 0,
          pending: 0,
          submitted: 0,
          failed: 0,
        }));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0 space-y-5">
        <section className="dashboard-card rounded-[28px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-1)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-tertiary)]">
                Workspace overview
              </p>
              <h2 className="mt-2 max-w-2xl text-[30px] font-black leading-tight tracking-[-0.045em] text-[var(--app-text-primary)]">
                Track applications, resume readiness, and role recommendations from one place.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ChromePrimaryLink href="/app/discovery">Find roles</ChromePrimaryLink>
              <Link
                href="/app/demo-milestone"
                className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-4 text-[13px] font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-0)] transition-[background-color,color] duration-150 hover:bg-[var(--app-bg-muted)]"
              >
                Demo checklist
              </Link>
              <ChromeIconLink href="/app/tracker" aria-label="Open tracker">
                <AppIcon name="arrow-up-right" className="size-5" />
              </ChromeIconLink>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Applications" value={total} detail="Total roles currently tracked." href="/app/tracker" />
          <KpiCard label="Pending review" value={pending} detail="Drafts or applications waiting for a decision." href="/app/approvals" />
          <KpiCard label="Submitted" value={submitted} detail="Applications marked as submitted." href="/app/tracker" />
        </div>

        <ApplicationsChart points={trend} />
      </div>

      <aside className="space-y-5">
        <ResumeReadiness value={summary?.resume_readiness ?? 0} status={summary?.resume_status} />
        <PipelineBreakdown byStatus={byStatus} total={total} />
        <RecentApplications applications={summary?.recent_applications ?? []} />
        <RecommendedRoles jobs={jobs} />
      </aside>
    </div>
  );
}
