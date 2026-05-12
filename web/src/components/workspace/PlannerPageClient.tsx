"use client";

import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/app-icon";
import { queryKeys } from "@/lib/query-keys";

import { MetricCard, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type MilestoneRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

function normStatus(s: string) {
  return s.toLowerCase();
}

function pctForStatus(status: string): number {
  const s = normStatus(status);
  if (s === "done" || s === "completed") return 100;
  if (s === "in_progress" || s === "doing") return 55;
  return 18;
}

export function PlannerPageClient() {
  const [view, setView] = useState("List");

  const q = useQuery({
    queryKey: queryKeys.milestones,
    queryFn: async () => {
      const r = await fetch("/api/me/milestones?limit=200", { cache: "no-store" });
      if (!r.ok) throw new Error("milestones");
      return (await r.json()) as MilestoneRow[];
    },
  });

  const rows = q.data ?? [];

  const { todo, doing, done } = useMemo(() => {
    let t = 0;
    let d = 0;
    let dn = 0;
    for (const m of rows) {
      const s = normStatus(m.status);
      if (s === "done" || s === "completed") dn += 1;
      else if (s === "in_progress" || s === "doing") d += 1;
      else t += 1;
    }
    return { todo: t, doing: d, done: dn };
  }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return copy;
  }, [rows]);

  const inProgressRows = sorted.filter((m) => {
    const s = normStatus(m.status);
    return s === "in_progress" || s === "doing";
  });
  const plannedRows = sorted.filter((m) => !["done", "completed", "in_progress", "doing"].includes(normStatus(m.status)));
  const doneRows = sorted.filter((m) => ["done", "completed"].includes(normStatus(m.status)));

  return (
    <ProductPageChrome
      title="Career Planner"
      description="Same milestones as Career steps — kanban-style grouping here."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard title="Planned" value={String(todo)} unit="(milestones)" icon="clipboard-check">
          Milestones in todo / upcoming status.
        </MetricCard>
        <MetricCard title="In progress" value={String(doing)} unit="(milestones)" icon="layers">
          Actively marked as in progress.
        </MetricCard>
        <MetricCard title="Completed" value={String(done)} unit="(milestones)" icon="check-circle">
          Marked done in Doubow.
        </MetricCard>
      </div>

      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl flex-wrap gap-1 rounded-full bg-[var(--app-bg-muted)] p-1">
            {(["List", "Kanban"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`min-h-10 flex-1 rounded-full px-5 text-[14px] font-semibold transition ${
                  view === v ? "bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-1)]" : "text-[var(--app-text-secondary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <ChromePrimaryLink href="/app/career-steps">
              <AppIcon name="plus" className="size-5" /> Add milestone
            </ChromePrimaryLink>
          </div>
        </div>

        {q.isLoading ? (
          <p className="mt-8 text-[13px] text-[var(--app-text-secondary)]">Loading milestones…</p>
        ) : q.isError ? (
          <p className="mt-8 text-[13px] text-[var(--app-badge-red-fg)]">Could not load milestones.</p>
        ) : view === "List" ? (
          <div className="mt-8 space-y-10">
            <section>
              <div className="flex items-center gap-3 text-[18px] font-bold">
                <AppIcon name="chevron-down" className="size-5" /> In progress <Tag>{doing}</Tag>
              </div>
              {inProgressRows.length === 0 ? (
                <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">Nothing in progress.</p>
              ) : (
                inProgressRows.map((m) => (
                  <MilestoneCard key={m.id} m={m} />
                ))
              )}
            </section>
            <section>
              <div className="flex items-center gap-3 text-[18px] font-bold">
                <AppIcon name="chevron-down" className="size-5" /> Planned <Tag>{todo}</Tag>
              </div>
              {plannedRows.length === 0 ? (
                <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">No upcoming milestones.</p>
              ) : (
                plannedRows.map((m) => (
                  <MilestoneCard key={m.id} m={m} />
                ))
              )}
            </section>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {[
              ["Planned", plannedRows],
              ["In Progress", inProgressRows],
              ["Completed", doneRows],
            ].map(([column, list]) => (
              <section key={String(column)} className="rounded-2xl bg-[var(--app-bg-muted)] p-5">
                <h3 className="text-[18px] font-bold">
                  {String(column)}{" "}
                  <span className="ml-2 text-[13px] text-[var(--app-text-secondary)]">{(list as MilestoneRow[]).length}</span>
                </h3>
                <div className="mt-5 space-y-4">
                  {(list as MilestoneRow[]).map((m) => (
                    <article key={m.id} className="rounded-xl bg-white p-4 shadow-[var(--app-shadow-0)]">
                      <div className="flex justify-between text-[13px]">
                        <span>{m.due_date ? `Due: ${m.due_date}` : "No due date"}</span>
                        <span className="text-[var(--app-text-tertiary)]">{m.status}</span>
                      </div>
                      <h4 className="mt-3 flex items-center gap-2 font-bold">
                        <AppIcon name="chevron-right" className="size-4" /> {m.title}
                      </h4>
                      <div className="mt-4">
                        <ProgressLine value={pctForStatus(m.status)} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </ProductPageChrome>
  );
}

function MilestoneCard({ m }: { m: MilestoneRow }) {
  const pct = pctForStatus(m.status);
  return (
    <article className="mt-5 rounded-2xl border border-[var(--app-border)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[18px] font-bold text-[var(--app-text-primary)]">
            <AppIcon name="chevron-down" className="size-4" /> {m.title}
          </h3>
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">Status: {m.status}</p>
        </div>
        <div className="flex items-center gap-3 text-[14px] text-[var(--app-text-primary)]">
          {m.due_date ? <span>Due: {m.due_date}</span> : null}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
        <ProgressLine value={pct} />
        <span className="font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Tag>{m.status}</Tag>
      </div>
    </article>
  );
}
