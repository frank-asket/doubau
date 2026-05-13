import Link from "next/link";

import { MetricCard, Tag } from "@/components/workspace/CareerHeroMockSections";
import { AppIcon } from "@/components/ui/app-icon";

export type HeroTrend = "up" | "down" | "flat";

export type HeroScoreMetric = {
  value: number;
  unit: string;
  delta_percent: number;
  trend: HeroTrend;
};

export type HeroDashboardPayload = {
  display_name: string;
  subscription: {
    show_upgrade_banner: boolean;
    plan_tier: string | null;
    price_gbp_month: number;
    headline: string;
  };
  metrics: {
    career_score: HeroScoreMetric;
    skills_growth: HeroScoreMetric;
    linkedin_health: HeroScoreMetric;
    cv_score: HeroScoreMetric;
  };
  career_goals: { phase: "current" | "next" | "future"; title: string; salary_label: string | null }[];
  application_trends: {
    buckets: {
      label: string;
      awaiting_response: number;
      response_received: number;
      rejected: number;
    }[];
    window_total: number;
    window_delta_percent: number;
    trend: HeroTrend;
  };
  top_picks: {
    job_id: string;
    title: string;
    company: string;
    seniority_caption: string;
    employment_type: string | null;
    workplace_caption: string;
    salary_caption: string | null;
    match_percent: number;
    source_url: string | null;
  }[];
};

const AWAIT = "#5b8def";
const RESP = "var(--app-success)";
const REJ = "#f472b6";

function formatDelta(deltaPercent: number, trend: HeroTrend) {
  if (trend === "flat") return "Stable";
  const sign = deltaPercent > 0 ? "+" : "";
  const arrow = trend === "up" ? "▲" : "▼";
  return `${sign}${deltaPercent}% ${arrow}`;
}

function metricTone(trend: HeroTrend): "green" | "red" | "blue" {
  if (trend === "up") return "green";
  if (trend === "down") return "red";
  return "blue";
}

function ApplicationTrendsChart({ data }: { data: HeroDashboardPayload["application_trends"] }) {
  const max = Math.max(
    1,
    ...data.buckets.map((p) => p.awaiting_response + p.response_received + p.rejected),
  );
  const hasActivity = data.buckets.some((p) => p.awaiting_response + p.response_received + p.rejected > 0);

  const deltaStr = formatDelta(data.window_delta_percent, data.trend);
  const deltaClass =
    data.trend === "up"
      ? "text-[var(--app-success)]"
      : data.trend === "down"
        ? "text-[var(--app-danger)]"
        : "text-[var(--app-text-tertiary)]";

  return (
    <section className="dashboard-card rounded-[28px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-1)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--app-text-primary)]">
            Application trends
          </h2>
          <p className="mt-1 text-[13px] text-[var(--app-text-secondary)]">
            Last 31 days by application outcome (stacked by week segment).
          </p>
        </div>
        <div className="text-right">
          <p className="tabular-nums text-[28px] font-black leading-none text-[var(--app-text-primary)]">
            {data.window_total}{" "}
            <span className="text-[14px] font-bold text-[var(--app-text-secondary)]">applications</span>
          </p>
          <p className={`mt-2 text-[13px] font-bold ${deltaClass}`}>{deltaStr}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-5 text-[12px] font-bold text-[var(--app-text-secondary)]">
        <span className="flex items-center gap-2">
          <i className="size-2.5 rounded-full" style={{ background: AWAIT }} />
          Awaiting response
        </span>
        <span className="flex items-center gap-2">
          <i className="size-2.5 rounded-full" style={{ background: RESP }} />
          Response received
        </span>
        <span className="flex items-center gap-2">
          <i className="size-2.5 rounded-full" style={{ background: REJ }} />
          Rejected
        </span>
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
          <div className="grid h-[280px] grid-cols-8 items-end gap-3 sm:gap-4">
            {data.buckets.map((point, index) => {
              const total = point.awaiting_response + point.response_received + point.rejected;
              const scale = total ? Math.max(10, Math.round((total / max) * 100)) : 2;
              const pct = (part: number) => (total ? Math.round((part / total) * 100) : 0);

              return (
                <div key={point.label} className="relative z-10 flex h-full flex-col justify-end gap-3">
                  <div className="flex flex-1 items-end justify-center px-1 pb-2 sm:px-2">
                    <div
                      className="dashboard-stack flex w-full max-w-16 flex-col justify-end overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(17,22,18,0.06)]"
                      style={{ height: `${scale}%`, animationDelay: `${index * 45}ms` }}
                      title={`${total} applications`}
                    >
                      <span className="block" style={{ height: `${pct(point.rejected)}%`, background: REJ }} />
                      <span
                        className="block"
                        style={{ height: `${pct(point.response_received)}%`, background: RESP }}
                      />
                      <span
                        className="block"
                        style={{ height: `${pct(point.awaiting_response)}%`, background: AWAIT }}
                      />
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
            No applications in the last 31 days. Save roles from Job Discovery to populate this chart.
          </p>
        </div>
      )}
    </section>
  );
}

function CareerGoalsPanel({ goals }: { goals: HeroDashboardPayload["career_goals"] }) {
  const labels: Record<string, string> = {
    current: "Current",
    next: "Next target",
    future: "Future potential",
  };

  return (
    <section className="ch-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-[var(--app-text-primary)]">Career goals</h2>
        <Link className="text-[13px] font-bold text-[var(--app-accent-700)]" href="/app/pathfinder">
          View all
        </Link>
      </div>
      <ol className="relative mt-6 space-y-6 pl-2">
        <span
          className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--app-border)]"
          aria-hidden
        />
        {goals.map((g, i) => (
          <li key={`${g.phase}-${i}`} className="relative flex gap-4 pl-8">
            <span
              className="absolute left-0 top-1.5 grid size-8 place-items-center rounded-full border-2 border-white bg-[var(--app-blue-500)] text-[12px] font-black text-white shadow-[var(--app-shadow-0)]"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">
                {labels[g.phase] ?? g.phase}
              </p>
              <p className="mt-1 text-[15px] font-bold text-[var(--app-text-primary)]">{g.title}</p>
              {g.salary_label ? (
                <p className="mt-1 text-[14px] font-semibold text-[var(--app-accent)]">{g.salary_label}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TopPicksPanel({ picks }: { picks: HeroDashboardPayload["top_picks"] }) {
  return (
    <section className="ch-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-[var(--app-text-primary)]">
          Top picks for your next role
        </h2>
        <Link className="text-[13px] font-bold text-[var(--app-accent-700)]" href="/app/discovery">
          View all
        </Link>
      </div>
      <div className="mt-5 space-y-4">
        {picks.length ? (
          picks.map((job) => {
            const inner = (
              <article className="ch-soft-card p-5 transition-[transform,box-shadow] duration-150 hover:shadow-[var(--app-shadow-1)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#111827] text-[12px] font-black text-white">
                      {job.company.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-[var(--app-text-primary)]">{job.title}</h3>
                      <p className="truncate text-[13px] font-semibold text-[var(--app-accent)]">{job.company}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_12%,white)] px-2.5 py-1 text-[11px] font-black text-[var(--app-accent-700)]">
                    {job.match_percent}%
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Tag>{job.seniority_caption}</Tag>
                  {job.employment_type ? <Tag>{job.employment_type}</Tag> : null}
                  <Tag>{job.workplace_caption}</Tag>
                </div>
                {job.salary_caption ? (
                  <p className="mt-4 text-[18px] font-bold text-[var(--app-accent)]">{job.salary_caption}</p>
                ) : null}
              </article>
            );
            return job.source_url ? (
              <Link key={job.job_id} href={job.source_url} target="_blank" rel="noreferrer" className="block">
                {inner}
              </Link>
            ) : (
              <Link key={job.job_id} href="/app/discovery" className="block">
                {inner}
              </Link>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] px-4 py-8 text-center text-[13px] text-[var(--app-text-secondary)]">
            Recommendations will appear once your résumé is indexed and jobs are available in discovery.
          </p>
        )}
      </div>
    </section>
  );
}

export function HeroDashboardShell({ data }: { data: HeroDashboardPayload }) {
  const sub = data.subscription;
  const m = data.metrics;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <header className="space-y-1">
          <h1 className="text-[22px] font-black tracking-[-0.03em] text-[var(--app-text-primary)] md:text-[26px]">
            Welcome back, {data.display_name}! <span aria-hidden>👋</span>
          </h1>
          <p className="text-[14px] text-[var(--app-text-secondary)]">
            Your career cockpit — scores, goals, and applications in one view.
          </p>
        </header>

        {sub.show_upgrade_banner ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[color-mix(in_srgb,var(--app-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,white)] px-5 py-4 shadow-[var(--app-shadow-0)]">
            <div className="flex min-w-0 items-start gap-3">
              <span className="text-xl" aria-hidden>
                💎
              </span>
              <p className="min-w-0 text-[14px] font-semibold leading-snug text-[var(--app-text-primary)]">
                {sub.headline}
              </p>
            </div>
            <Link
              href="/app/billing"
              className="inline-flex shrink-0 items-center gap-1 text-[14px] font-bold text-[var(--app-blue-500)] hover:underline"
            >
              Upgrade now
              <AppIcon name="chevron-right" className="size-4" />
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            title="Career score"
            value={String(m.career_score.value)}
            unit={m.career_score.unit}
            delta={formatDelta(m.career_score.delta_percent, m.career_score.trend)}
            tone={metricTone(m.career_score.trend)}
            icon="sparkle"
          >
            <Link href="/app/career-health" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </MetricCard>
          <MetricCard
            title="Skills growth"
            value={String(m.skills_growth.value)}
            unit={m.skills_growth.unit}
            delta={formatDelta(m.skills_growth.delta_percent, m.skills_growth.trend)}
            tone={metricTone(m.skills_growth.trend)}
            icon="clipboard-check"
          >
            <Link href="/app/skill-gap-analysis" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </MetricCard>
          <MetricCard
            title="LinkedIn health"
            value={String(m.linkedin_health.value)}
            unit={m.linkedin_health.unit}
            delta={formatDelta(m.linkedin_health.delta_percent, m.linkedin_health.trend)}
            tone={metricTone(m.linkedin_health.trend)}
            icon="building"
          >
            <Link href="/app/linkedin-analysis" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </MetricCard>
          <MetricCard
            title="CV score"
            value={String(m.cv_score.value)}
            unit={m.cv_score.unit}
            delta={formatDelta(m.cv_score.delta_percent, m.cv_score.trend)}
            tone={metricTone(m.cv_score.trend)}
            icon="file-text"
          >
            <Link href="/app/ats-optimizer" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </MetricCard>
        </div>

        <ApplicationTrendsChart data={data.application_trends} />
      </div>

      <aside className="space-y-5">
        <CareerGoalsPanel goals={data.career_goals} />
        <TopPicksPanel picks={data.top_picks} />
      </aside>
    </div>
  );
}
