import Link from "next/link";
import type { ReactNode } from "react";

import { ApplicationTrendsChart } from "@/components/dashboard/ApplicationTrendsChart";
import { HeroMetricCard } from "@/components/dashboard/HeroMetricCard";
import { JobCompanyMark } from "@/components/discovery/JobCompanyMark";
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

function CareerGoalsPanel({ goals }: { goals: HeroDashboardPayload["career_goals"] }) {
  const labels: Record<string, string> = {
    current: "Current",
    next: "Next target",
    future: "Future potential",
  };

  return (
    <section className="dashboard-rail-card p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-secondary)]">
          Career goals
        </h2>
        <Link className="text-[13px] font-bold text-[var(--app-text-primary)] underline-offset-4 hover:underline" href="/app/pathfinder">
          View all
        </Link>
      </div>
      <ol className="relative mt-7 space-y-7 pl-2">
        <span
          className="absolute left-[17px] top-3 bottom-3 w-px bg-[color-mix(in_srgb,var(--app-border)_70%,transparent)]"
          aria-hidden
        />
        {goals.map((g, i) => (
          <li key={`${g.phase}-${i}`} className="relative flex gap-4 pl-9">
            <span
              className="absolute left-0 top-1 grid size-9 place-items-center rounded-full border-2 border-white bg-[#1a1d24] text-[12px] font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-tertiary)]">
                {labels[g.phase] ?? g.phase}
              </p>
              <p className="mt-1.5 text-[16px] font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">{g.title}</p>
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

function DashboardJobTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-[30px] items-center rounded-full border border-[color-mix(in_srgb,var(--app-border)_55%,white)] bg-white/70 px-3.5 py-1 text-[12px] font-semibold text-[var(--app-text-secondary)] shadow-[0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm">
      {children}
    </span>
  );
}

function TopPicksPanel({ picks }: { picks: HeroDashboardPayload["top_picks"] }) {
  return (
    <section className="dashboard-rail-card p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-secondary)]">
          Top picks for your next role
        </h2>
        <Link className="text-[13px] font-bold text-[var(--app-text-primary)] underline-offset-4 hover:underline" href="/app/discovery">
          View all
        </Link>
      </div>
      <div className="mt-5 space-y-4">
        {picks.length ? (
          picks.map((job) => {
            const inner = (
              <article className="rounded-[28px] border border-[color-mix(in_srgb,white_72%,var(--app-border))] bg-white/55 p-5 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-md transition-[transform,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <JobCompanyMark
                      company={job.company}
                      sourceUrl={job.source_url}
                      size="detail"
                      presentation="muted"
                      className="!rounded-full shadow-none ring-1 ring-[color-mix(in_srgb,var(--app-border)_65%,transparent)]"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">
                        {job.title}
                      </h3>
                      <p className="truncate text-[13px] font-semibold text-[var(--app-text-secondary)]">{job.company}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#1a1d24] px-3 py-1.5 text-[11px] font-black tracking-wide text-white">
                    {job.match_percent}%
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <DashboardJobTag>{job.seniority_caption}</DashboardJobTag>
                  {job.employment_type ? <DashboardJobTag>{job.employment_type}</DashboardJobTag> : null}
                  <DashboardJobTag>{job.workplace_caption}</DashboardJobTag>
                </div>
                {job.salary_caption ? (
                  <p className="mt-4 text-[18px] font-black tracking-tight text-[var(--app-text-primary)]">
                    {job.salary_caption}
                  </p>
                ) : null}
              </article>
            );
            return (
              <Link key={job.job_id} href={`/app/discovery/${job.job_id}`} className="block">
                {inner}
              </Link>
            );
          })
        ) : (
          <p className="rounded-[28px] border border-dashed border-[color-mix(in_srgb,var(--app-border)_80%,transparent)] bg-white/40 px-4 py-8 text-center text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
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
      <div className="min-w-0 space-y-6">
        <header className="space-y-2">
          <h1 className="text-[26px] font-black leading-[1.15] tracking-[-0.04em] text-[var(--app-text-primary)] md:text-[32px]">
            Welcome back, {data.display_name}! <span aria-hidden>👋</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-[var(--app-text-secondary)]">
            Your career cockpit — scores, goals, and applications in one view.
          </p>
        </header>

        {sub.show_upgrade_banner ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_8%,white),white)] px-6 py-5 shadow-[0_20px_52px_rgba(15,23,42,0.055)]">
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
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-full bg-[#1a1d24] px-5 text-[14px] font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition-transform duration-150 hover:-translate-y-px"
            >
              Upgrade now
              <AppIcon name="chevron-right" className="size-4" />
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <HeroMetricCard
            title="Career score"
            value={String(m.career_score.value)}
            unit={m.career_score.unit}
            delta={formatDelta(m.career_score.delta_percent, m.career_score.trend)}
            tone={metricTone(m.career_score.trend)}
            icon="sparkle"
            sparkline={m.career_score.series_14d}
            staggerIndex={0}
            palette="peach"
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
            palette="blush"
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
            palette="sky"
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
            palette="cream"
          >
            <Link href="/app/ats-optimizer" className="font-bold text-[var(--app-accent-700)] hover:underline">
              Improve
            </Link>
          </HeroMetricCard>
        </div>

        <ApplicationTrendsChart
          key={[
            data.application_trends.window_total,
            ...data.application_trends.buckets.flatMap((b) => [
              b.awaiting_response,
              b.response_received,
              b.rejected,
            ]),
          ].join(":")}
          data={data.application_trends}
        />
      </div>

      <aside className="space-y-5 xl:pt-1">
        <CareerGoalsPanel goals={data.career_goals} />
        <TopPicksPanel picks={data.top_picks} />
      </aside>
    </div>
  );
}
