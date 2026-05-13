"use client";

import Link from "next/link";
import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

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
  updated_at: string;
};

type MilestoneCalendarCell = {
  day: string | null;
  milestones: MilestoneRow[];
};

type MilestoneCalendarPayload = {
  month: string;
  weeks: MilestoneCalendarCell[][];
  undated: MilestoneRow[];
};

const EMPTY_MILESTONES: MilestoneRow[] = [];

const VIEWS = ["List", "Kanban", "Calendar"] as const;
type PlannerView = (typeof VIEWS)[number];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function normStatus(s: string) {
  return s.toLowerCase();
}

function pctForStatus(status: string): number {
  const s = normStatus(status);
  if (s === "done" || s === "completed") return 100;
  if (s === "in_progress" || s === "doing") return 55;
  return 18;
}

function formatMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return formatMonthKey(d);
}

function isPlannedStatus(status: string) {
  const s = normStatus(status);
  return !["done", "completed", "in_progress", "doing"].includes(s);
}

function isDoingStatus(status: string) {
  const s = normStatus(status);
  return s === "in_progress" || s === "doing";
}

function isDoneStatus(status: string) {
  const s = normStatus(status);
  return s === "done" || s === "completed";
}

/** Kanban column → persisted status (Career steps select values). */
const COLUMN_STATUS = {
  planned: "todo",
  doing: "in_progress",
  done: "done",
} as const;

export function PlannerPageClient() {
  const qc = useQueryClient();
  const [view, setView] = useState<PlannerView>("List");
  const [month, setMonth] = useState(() => formatMonthKey(new Date()));

  const q = useQuery({
    queryKey: queryKeys.milestones,
    queryFn: async () => {
      const r = await fetch("/api/me/milestones?limit=200", { cache: "no-store" });
      if (!r.ok) throw new Error("milestones");
      return (await r.json()) as MilestoneRow[];
    },
  });

  const calQ = useQuery({
    queryKey: queryKeys.milestonesCalendar(month),
    queryFn: async () => {
      const r = await fetch(`/api/me/milestones/calendar?month=${encodeURIComponent(month)}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("calendar");
      return (await r.json()) as MilestoneCalendarPayload;
    },
    enabled: view === "Calendar",
  });

  const invalidateMilestones = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.milestones }),
      qc.invalidateQueries({ queryKey: ["milestones-calendar"] }),
    ]);
  }, [qc]);

  const patchM = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/me/milestones/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("patch");
      return (await r.json()) as MilestoneRow;
    },
    onSuccess: invalidateMilestones,
  });

  const rows = q.data ?? EMPTY_MILESTONES;

  const { todo, doing, done } = useMemo(() => {
    let t = 0;
    let d = 0;
    let dn = 0;
    for (const m of rows) {
      if (isDoneStatus(m.status)) dn += 1;
      else if (isDoingStatus(m.status)) d += 1;
      else t += 1;
    }
    return { todo: t, doing: d, done: dn };
  }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return copy;
  }, [rows]);

  const inProgressRows = sorted.filter((m) => isDoingStatus(m.status));
  const plannedRows = sorted.filter((m) => isPlannedStatus(m.status));
  const doneRows = sorted.filter((m) => isDoneStatus(m.status));

  const onDropColumn = (status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain").trim();
    if (!id) return;
    const row = rows.find((r) => r.id === id);
    if (!row || row.status === status) return;
    patchM.mutate({ id, status });
  };

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <ProductPageChrome
      title="Career Planner"
      description="List, Kanban, and calendar views over the same milestones as Career steps — drag cards to update status, or set due dates there to populate the month grid."
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
          <div className="flex max-w-2xl flex-wrap gap-1 rounded-full bg-[var(--app-bg-muted)] p-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`min-h-10 flex-1 rounded-full px-4 text-[13px] font-semibold transition sm:px-5 sm:text-[14px] ${
                  view === v ? "bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-1)]" : "text-[var(--app-text-secondary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {view === "Calendar" ? (
              <div className="flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-2 py-1">
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                  aria-label="Previous month"
                  onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
                >
                  <AppIcon name="chevron-right" className="size-4 rotate-180" />
                </button>
                <span className="min-w-[8.5rem] text-center text-[13px] font-semibold tabular-nums text-[var(--app-text-primary)]">
                  {month}
                </span>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                  aria-label="Next month"
                  onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
                >
                  <AppIcon name="chevron-right" className="size-4" />
                </button>
                <button
                  type="button"
                  className="ml-1 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--app-accent)] hover:bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]"
                  onClick={() => setMonth(formatMonthKey(new Date()))}
                >
                  Today
                </button>
              </div>
            ) : null}
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
          <ListBody inProgressRows={inProgressRows} plannedRows={plannedRows} doing={doing} todo={todo} />
        ) : view === "Kanban" ? (
          <KanbanBody
            plannedRows={plannedRows}
            inProgressRows={inProgressRows}
            doneRows={doneRows}
            patchPending={patchM.isPending}
            onDropColumn={onDropColumn}
            allowDrop={allowDrop}
          />
        ) : calQ.isLoading ? (
          <p className="mt-8 text-[13px] text-[var(--app-text-secondary)]">Loading calendar…</p>
        ) : calQ.isError ? (
          <p className="mt-8 text-[13px] text-[var(--app-badge-red-fg)]">Could not load calendar.</p>
        ) : (
          <CalendarBody data={calQ.data!} />
        )}
      </section>
    </ProductPageChrome>
  );
}

function ListBody({
  inProgressRows,
  plannedRows,
  doing,
  todo,
}: {
  inProgressRows: MilestoneRow[];
  plannedRows: MilestoneRow[];
  doing: number;
  todo: number;
}) {
  return (
    <div className="mt-8 space-y-10">
      <section>
        <div className="flex items-center gap-3 text-[18px] font-bold">
          <AppIcon name="chevron-down" className="size-5" /> In progress <Tag>{doing}</Tag>
        </div>
        {inProgressRows.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">Nothing in progress.</p>
        ) : (
          inProgressRows.map((m) => <MilestoneCard key={m.id} m={m} />)
        )}
      </section>
      <section>
        <div className="flex items-center gap-3 text-[18px] font-bold">
          <AppIcon name="chevron-down" className="size-5" /> Planned <Tag>{todo}</Tag>
        </div>
        {plannedRows.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">No upcoming milestones.</p>
        ) : (
          plannedRows.map((m) => <MilestoneCard key={m.id} m={m} />)
        )}
      </section>
    </div>
  );
}

function KanbanBody({
  plannedRows,
  inProgressRows,
  doneRows,
  patchPending,
  onDropColumn,
  allowDrop,
}: {
  plannedRows: MilestoneRow[];
  inProgressRows: MilestoneRow[];
  doneRows: MilestoneRow[];
  patchPending: boolean;
  onDropColumn: (status: string) => (e: React.DragEvent) => void;
  allowDrop: (e: React.DragEvent) => void;
}) {
  const columns: { title: string; rows: MilestoneRow[]; status: string }[] = [
    { title: "Planned", rows: plannedRows, status: COLUMN_STATUS.planned },
    { title: "In progress", rows: inProgressRows, status: COLUMN_STATUS.doing },
    { title: "Completed", rows: doneRows, status: COLUMN_STATUS.done },
  ];

  return (
    <div className="mt-8">
      <p className="mb-4 text-[12px] text-[var(--app-text-tertiary)]">
        Drag a card into another column to update status{patchPending ? "…" : "."}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <section
            key={col.title}
            className="min-h-[280px] rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-bg-muted)_88%,transparent)] p-4 lg:min-h-[360px]"
            onDragOver={allowDrop}
            onDrop={onDropColumn(col.status)}
          >
            <h3 className="flex items-baseline justify-between border-b border-[var(--app-border)] pb-3 text-[15px] font-bold text-[var(--app-text-primary)]">
              {col.title}
              <span className="text-[12px] font-semibold tabular-nums text-[var(--app-text-secondary)]">{col.rows.length}</span>
            </h3>
            <div className="mt-4 space-y-3">
              {col.rows.map((m) => (
                <article
                  key={m.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", m.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-3 shadow-[var(--app-shadow-0)] active:cursor-grabbing"
                >
                  <div className="flex justify-between gap-2 text-[11px] text-[var(--app-text-tertiary)]">
                    <span>{m.due_date ? `Due ${m.due_date}` : "No due date"}</span>
                    <span className="shrink-0 font-mono">{m.status}</span>
                  </div>
                  <h4 className="mt-2 text-[14px] font-semibold text-[var(--app-text-primary)]">{m.title}</h4>
                  <div className="mt-3">
                    <ProgressLine value={pctForStatus(m.status)} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CalendarBody({ data }: { data: MilestoneCalendarPayload }) {
  return (
    <div className="mt-8 space-y-8">
      <div className="overflow-x-auto rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((d) => (
                <th key={d} className="border-b border-[var(--app-border)] px-2 py-2 font-semibold text-[var(--app-text-tertiary)]">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`align-top border-b border-[var(--app-border)] p-1.5 ${
                      cell.day ? "min-h-[88px] bg-[var(--app-bg-page)]" : "bg-[var(--app-bg-muted)]/40"
                    }`}
                  >
                    {cell.day ? (
                      <>
                        <div className="mb-1 font-semibold tabular-nums text-[var(--app-text-secondary)]">
                          {String(cell.day).slice(8, 10)}
                        </div>
                        <ul className="space-y-1">
                          {cell.milestones.map((m) => (
                            <li
                              key={m.id}
                              className="rounded-md border border-[var(--app-border)] bg-white px-1.5 py-1 text-[11px] font-medium leading-snug text-[var(--app-text-primary)] shadow-[var(--app-shadow-0)]"
                            >
                              {m.title}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h3 className="text-[14px] font-bold text-[var(--app-text-primary)]">
          Unscheduled <Tag>{data.undated.length}</Tag>
        </h3>
        <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
          Milestones without a due date (set dates in{" "}
          <Link href="/app/career-steps" className="font-medium text-[var(--app-accent)] hover:underline">
            Career steps
          </Link>
          ).
        </p>
        {data.undated.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--app-text-tertiary)]">None — everything this month is dated.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.undated.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-muted)]/40 px-3 py-2 text-[13px]"
              >
                <span className="font-medium text-[var(--app-text-primary)]">{m.title}</span>
                <Tag>{m.status}</Tag>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
