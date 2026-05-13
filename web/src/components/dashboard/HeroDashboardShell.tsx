import Link from "next/link";

import { HeroMetricCard } from "@/components/dashboard/HeroMetricCard";
import { Tag } from "@/components/workspace/CareerHeroMockSections";
import { AppIcon } from "@/components/ui/app-icon";

export type HeroTrend = "up" | "down" | "flat";

export type HeroScoreMetric = {
  value: number;
  unit: string;
  delta_percent: number;
  trend: HeroTrend;
  series_14d: number[];
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

/** Stacked outcome chart — muted palette reads as analytics, not marketing. */
const OUTCOME_COLORS = {
  awaiting: "#64748b",
  response: "#0f766e",
  rejected: "#a63d52",
} as const;

function formatDelta(deltaPercent: number, trend: HeroTrend) {
  if (trend === "flat") return "Stable";
  const sign = deltaPercent > 0 ? "+" : "";
  const arrow = trend === "up" ? "▲" : "▼";
  return `${sign}${deltaPercent}% ${arrow}`;
}

function formatPeriodDeltaLabel(deltaPercent: number, trend: HeroTrend): string {
  if (trend === "flat") return "Flat vs prior 31-day window";
  const sign = deltaPercent > 0 ? "+" : "";
  const dir = trend === "up" ? "Up" : "Down";
  return `${dir} ${sign}${Math.abs(deltaPercent)}% vs prior 31 days`;
}

function metricTone(trend: HeroTrend): "green" | "red" | "blue" {
  if (trend === "up") return "green";
  if (trend === "down") return "red";
  return "blue";
}

function niceYAxisMax(n: number): number {
  if (n <= 0) return 1;
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  const exp = 10 ** Math.floor(Math.log10(n));
  const f = n / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function segmentHeightsPx(
  awaiting: number,
  response: number,
  rejected: number,
  total: number,
  columnPx: number,
): { awaiting: number; response: number; rejected: number } {
  if (!total || columnPx <= 0) return { awaiting: 0, response: 0, rejected: 0 };
  const ha = Math.floor((awaiting / total) * columnPx);
  const hr = Math.floor((response / total) * columnPx);
  const hj = columnPx - ha - hr;
  return { awaiting: ha, response: hr, rejected: Math.max(0, hj) };
}

function ApplicationTrendsChart({ data }: { data: HeroDashboardPayload["application_trends"] }) {
  const bucketTotals = data.buckets.map(
    (p) => p.awaiting_response + p.response_received + p.rejected,
  );
  const dataMax = Math.max(0, ...bucketTotals);
  const yMax = niceYAxisMax(dataMax);
  const hasActivity = bucketTotals.some((t) => t > 0);

  const deltaStr = formatPeriodDeltaLabel(data.window_delta_percent, data.trend);
  const deltaClass =
    data.trend === "up"
      ? "text-[#0f766e]"
      : data.trend === "down"
        ? "text-[#a63d52]"
        : "text-[var(--app-text-tertiary)]";

  const plotH = 216;
  const yTicks = [yMax, Math.round(yMax / 2), 0];

  const legend = (
    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--app-border)] pt-4 text-[12px] font-medium text-[var(--app-text-secondary)]">
      <li className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-sm ring-1 ring-black/[0.08]"
          style={{ backgroundColor: OUTCOME_COLORS.awaiting }}
          aria-hidden
        />
        Awaiting response
      </li>
      <li className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-sm ring-1 ring-black/[0.08]"
          style={{ backgroundColor: OUTCOME_COLORS.response }}
          aria-hidden
        />
        Response received
      </li>
      <li className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-sm ring-1 ring-black/[0.08]"
          style={{ backgroundColor: OUTCOME_COLORS.rejected }}
          aria-hidden
        />
        Rejected
      </li>
    </ul>
  );

  return (
    <section className="dashboard-card rounded-[28px] border border-[var(--app-border)] bg-white/90 p-6 shadow-[var(--app-shadow-1)]">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--app-border)] pb-5">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">
            Application outcomes
          </h2>
          <p className="max-w-xl text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            Stacked counts by calendar day band (last 31 days). Segments sum to applications created in each band; split
            reflects current pipeline status.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
            Window total
          </p>
          <p className="mt-1 tabular-nums text-[26px] font-semibold leading-none tracking-tight text-[var(--app-text-primary)]">
            {data.window_total}
          </p>
          <p className={`mt-2 text-[12px] font-medium tabular-nums ${deltaClass}`}>{deltaStr}</p>
        </div>
      </div>

      {legend}

      {hasActivity ? (
        <figure className="mt-6">
          <div className="flex gap-0 sm:gap-1">
            <div
              className="flex w-9 shrink-0 flex-col justify-between text-right text-[10px] font-medium tabular-nums leading-none text-[var(--app-text-tertiary)] sm:w-10 sm:text-[11px]"
              style={{ height: plotH }}
              aria-hidden
            >
              <span>{yMax}</span>
              <span>{yTicks[1]}</span>
              <span>0</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="relative" style={{ height: plotH }}>
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col justify-between"
                  aria-hidden
                >
                  <div className="h-px w-full bg-[var(--app-border)]" />
                  <div className="h-px w-full bg-[var(--app-border)]" />
                  <div className="h-px w-full bg-[var(--app-border-strong)]" />
                </div>
                <div
                  className="relative z-[1] flex h-full items-end gap-1.5 sm:gap-2"
                  role="group"
                  aria-label="Application outcome stacks by day band"
                >
                  {data.buckets.map((point) => {
                    const total = point.awaiting_response + point.response_received + point.rejected;
                    const columnPx =
                      total > 0 ? Math.max(4, Math.round((total / yMax) * plotH)) : 0;
                    const { awaiting: ha, response: hr, rejected: hj } = segmentHeightsPx(
                      point.awaiting_response,
                      point.response_received,
                      point.rejected,
                      total,
                      columnPx,
                    );

                    return (
                      <div
                        key={point.label}
                        className="flex min-w-0 flex-1 flex-col items-stretch justify-end"
                      >
                        <div
                          className="mx-auto flex w-full max-w-[52px] flex-col justify-end overflow-hidden rounded-t-[5px] bg-[var(--app-bg-muted)] ring-1 ring-[var(--app-border)]"
                          style={{ height: columnPx }}
                          title={`${total} applications · ${point.awaiting_response} awaiting · ${point.response_received} response · ${point.rejected} rejected`}
                        >
                          {point.awaiting_response > 0 ? (
                            <div
                              className="w-full shrink-0 border-t border-white/[0.18] first:border-t-0"
                              style={{
                                height: ha,
                                backgroundColor: OUTCOME_COLORS.awaiting,
                              }}
                            />
                          ) : null}
                          {point.response_received > 0 ? (
                            <div
                              className="w-full shrink-0 border-t border-white/[0.18]"
                              style={{
                                height: hr,
                                backgroundColor: OUTCOME_COLORS.response,
                              }}
                            />
                          ) : null}
                          {point.rejected > 0 ? (
                            <div
                              className="w-full shrink-0 border-t border-white/[0.18]"
                              style={{
                                height: hj,
                                backgroundColor: OUTCOME_COLORS.rejected,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-8 gap-1.5 sm:gap-2">
                {data.buckets.map((point) => {
                  const total = point.awaiting_response + point.response_received + point.rejected;
                  return (
                    <div key={`x-${point.label}`} className="min-w-0 text-center">
                      <p className="tabular-nums text-[12px] font-semibold text-[var(--app-text-primary)]">{total}</p>
                      <p className="mt-1 truncate text-[10px] font-medium text-[var(--app-text-tertiary)] sm:text-[11px]">
                        {point.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <figcaption className="sr-only">
            Stacked bar chart of application outcomes over eight day ranges in the last month. Maximum axis value{" "}
            {yMax}.
          </figcaption>
        </figure>
      ) : (
        <div className="mt-6 flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/80 px-6 text-center">
          <p className="max-w-md text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            No applications recorded in this window. Data will appear when roles are saved from Job Discovery and show up
            in your tracker.
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
          <HeroMetricCard
            title="Career score"
            value={String(m.career_score.value)}
            unit={m.career_score.unit}
            delta={formatDelta(m.career_score.delta_percent, m.career_score.trend)}
            tone={metricTone(m.career_score.trend)}
            icon="sparkle"
            sparkline={m.career_score.series_14d}
            staggerIndex={0}
          >
            <Link href="/app/career-health" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </HeroMetricCard>
          <HeroMetricCard
            title="Skills growth"
            value={String(m.skills_growth.value)}
            unit={m.skills_growth.unit}
            delta={formatDelta(m.skills_growth.delta_percent, m.skills_growth.trend)}
            tone={metricTone(m.skills_growth.trend)}
            icon="clipboard-check"
            sparkline={m.skills_growth.series_14d}
            staggerIndex={1}
          >
            <Link href="/app/skill-gap-analysis" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </HeroMetricCard>
          <HeroMetricCard
            title="LinkedIn health"
            value={String(m.linkedin_health.value)}
            unit={m.linkedin_health.unit}
            delta={formatDelta(m.linkedin_health.delta_percent, m.linkedin_health.trend)}
            tone={metricTone(m.linkedin_health.trend)}
            icon="building"
            sparkline={m.linkedin_health.series_14d}
            staggerIndex={2}
          >
            <Link href="/app/linkedin-analysis" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </HeroMetricCard>
          <HeroMetricCard
            title="CV score"
            value={String(m.cv_score.value)}
            unit={m.cv_score.unit}
            delta={formatDelta(m.cv_score.delta_percent, m.cv_score.trend)}
            tone={metricTone(m.cv_score.trend)}
            icon="file-text"
            sparkline={m.cv_score.series_14d}
            staggerIndex={3}
          >
            <Link href="/app/ats-optimizer" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </HeroMetricCard>
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
