"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/app-icon";
import {
  goalFocusList,
  labelForGoalId,
  readinessPercent,
  type ProfileDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { MetricCard, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type WorkspaceSummary = {
  resume_status?: string | null;
  applications_total?: number;
  applications_by_status?: Record<string, number>;
};

type MilestoneRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  meta: Record<string, unknown>;
};

export function CareerSuccessPageClient() {
  const profileQ = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return r.json() as ProfileDto;
    },
  });

  const workspaceQ = useQuery({
    queryKey: queryKeys.workspaceSummary,
    queryFn: async () => {
      const r = await fetch("/api/me/workspace/summary", { cache: "no-store" });
      if (!r.ok) throw new Error("workspace");
      return r.json() as WorkspaceSummary;
    },
  });

  const milestonesQ = useQuery({
    queryKey: queryKeys.milestones,
    queryFn: async () => {
      const r = await fetch("/api/me/milestones?limit=100", { cache: "no-store" });
      if (!r.ok) throw new Error("milestones");
      return r.json() as MilestoneRow[];
    },
  });

  const metricsQ = useQuery({
    queryKey: queryKeys.matchMetrics(30),
    queryFn: async () => {
      const r = await fetch("/api/me/match/metrics?days=30", { cache: "no-store" });
      if (!r.ok) throw new Error("metrics");
      return r.json() as { window_days?: number; by_event_type?: Record<string, number> };
    },
  });

  const ws = workspaceQ.data;
  const milestones = milestonesQ.data ?? [];
  const readiness = readinessPercent(ws?.resume_status);

  const totalApps = ws?.applications_total ?? 0;
  const submitted = ws?.applications_by_status?.SUBMITTED ?? 0;
  const submittedPct = totalApps ? Math.round((submitted / totalApps) * 100) : 0;

  const milestonesDone = milestones.filter((m) => ["done", "completed"].includes(m.status.toLowerCase())).length;
  const milestoneProgress = milestones.length ? Math.round((milestonesDone / milestones.length) * 100) : 0;

  const matchTotals = metricsQ.data?.by_event_type ?? {};
  const matchInteractionSum = Object.values(matchTotals).reduce(
    (acc, n) => acc + (typeof n === "number" ? n : 0),
    0,
  );

  const focuses = goalFocusList(profileQ.data?.goals ?? null);

  const achievements = useMemo(() => {
    const out: { title: string; body: string; tag: string }[] = [];
    if (milestonesDone > 0) {
      out.push({
        title: "Milestones completed",
        body: `${milestonesDone} milestone${milestonesDone === 1 ? "" : "s"} marked done in Doubow.`,
        tag: "Progress",
      });
    }
    if (submitted > 0) {
      out.push({
        title: "Applications submitted",
        body: `${submitted} submission${submitted === 1 ? "" : "s"} recorded in your pipeline.`,
        tag: "Pipeline",
      });
    }
    if (readiness >= 100) {
      out.push({
        title: "Résumé embedded",
        body: "Your latest résumé is embedded for matching.",
        tag: "Signal",
      });
    }
    return out;
  }, [milestonesDone, submitted, readiness]);

  return (
    <ProductPageChrome title="Career Success">
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard title="Résumé readiness" value={`${readiness}%`} unit="" delta={readiness >= 72 ? "Strong" : "Build"} icon="layers">
            Embedding unlocks higher-quality job matching — upload on CV Builder if this is low.
          </MetricCard>
          <MetricCard
            title="Milestone progress"
            value={`${milestoneProgress}%`}
            unit=""
            tone={milestoneProgress >= 50 ? "green" : "red"}
            icon="analytics"
          >
            Share of milestones marked done versus total milestones you&apos;ve created.
          </MetricCard>
          <MetricCard title="Pipeline submissions" value={String(submitted)} unit="(submitted)" icon="message-circle">
            Out of {totalApps} tracked applications in Doubow.
          </MetricCard>
          <MetricCard
            title="Match events (30d)"
            value={metricsQ.isSuccess ? String(matchInteractionSum) : "—"}
            unit=""
            icon="briefcase"
          >
            Sum of job match telemetry events (views, saves, dismissals) in the configured window.
          </MetricCard>
        </div>
        <section className="ch-panel p-6">
          <h2 className="text-[18px] font-bold">Pipeline mix</h2>
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">
            Submitted ≈ {submittedPct}% of tracked applications.
          </p>
          <div className="mt-6 space-y-5">
            {["DISCOVERED", "DRAFTED", "PENDING_APPROVAL", "SUBMITTED"].map((key) => {
              const n = ws?.applications_by_status?.[key] ?? 0;
              const pct = totalApps ? Math.round((n / totalApps) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-[13px] font-semibold">
                    <span>{key.replaceAll("_", " ")}</span>
                    <span className="tabular-nums">{n}</span>
                  </div>
                  <div className="mt-2">
                    <ProgressLine value={pct} />
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/app/dashboard" className="mt-6 inline-flex text-[13px] font-semibold text-[var(--app-accent)] hover:underline">
            Open dashboard
          </Link>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ch-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold">Goals & milestones</h2>
            <Link
              href="/app/career-steps"
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 font-semibold text-[var(--app-accent)] hover:bg-[var(--app-bg-muted)]"
            >
              <AppIcon name="plus" className="size-4" /> Manage milestones
            </Link>
          </div>
          {milestonesQ.isLoading ? (
            <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">Loading…</p>
          ) : milestones.length === 0 ? (
            <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">
              No milestones yet — add them under{" "}
              <Link href="/app/career-steps" className="font-medium text-[var(--app-accent)] hover:underline">
                Career steps
              </Link>
              .
            </p>
          ) : (
            milestones.slice(0, 6).map((m) => {
              const done = ["done", "completed"].includes(m.status.toLowerCase());
              const pct = done ? 100 : m.status.toLowerCase() === "in_progress" ? 55 : 15;
              return (
                <article key={m.id} className="mt-5 border-b border-dashed border-[var(--app-border)] pb-5 last:border-0">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-bold">{m.title}</h3>
                    <span className="font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-4">
                    <ProgressLine value={pct} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Tag>{m.status}</Tag>
                    {m.due_date ? <Tag>{m.due_date}</Tag> : null}
                  </div>
                </article>
              );
            })
          )}
          {focuses.length ? (
            <div className="mt-8 border-t border-dashed border-[var(--app-border)] pt-6">
              <h3 className="font-bold">Profile goal focus</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {focuses.map((id) => (
                  <Tag key={id}>{labelForGoalId(id)}</Tag>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Recent achievements</h2>
          {achievements.length === 0 ? (
            <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">
              Complete milestones or move applications to submitted to populate wins.
            </p>
          ) : (
            achievements.map((a) => (
              <article key={a.title} className="mt-5 border-b border-dashed border-[var(--app-border)] pb-5 last:border-0">
                <h3 className="font-bold">{a.title}</h3>
                <p className="mt-2 text-[15px] text-[var(--app-text-primary)]">{a.body}</p>
                <div className="mt-4 flex gap-2">
                  <Tag>{a.tag}</Tag>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </ProductPageChrome>
  );
}
