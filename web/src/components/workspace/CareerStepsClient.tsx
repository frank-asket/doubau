"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppButton } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";

import { CareerFlowProgress } from "./CareerHeroMockSections";
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

function statusPill(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "done" || s === "completed") {
    return { label: "Done", className: "bg-[#EAF3DE] text-[#27500A]" };
  }
  if (s === "in_progress" || s === "doing") {
    return { label: "In progress", className: "bg-[var(--app-badge-blue-bg)] text-[#0C447C]" };
  }
  return { label: "Upcoming", className: "border border-[var(--app-border)] bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)]" };
}

function circleFor(status: string, index: number): { className: string; content: ReactNode } {
  const s = status.toLowerCase();
  if (s === "done" || s === "completed") {
    return {
      className: "bg-[#639922] text-white",
      content: (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    };
  }
  if (s === "in_progress" || s === "doing") {
    return {
      className: "bg-[var(--app-accent)] text-white text-[10px] font-semibold",
      content: String(index + 1),
    };
  }
  return {
    className: "border-2 border-[var(--app-border)] bg-[var(--app-bg-elevated)] text-[10px] font-medium text-[var(--app-text-tertiary)]",
    content: String(index + 1),
  };
}

export function CareerStepsClient() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const q = useQuery({
    queryKey: queryKeys.milestones,
    queryFn: async () => {
      const r = await fetch("/api/me/milestones?limit=100", { cache: "no-store" });
      if (!r.ok) throw new Error("milestones");
      return r.json() as Promise<MilestoneRow[]>;
    },
  });

  const sorted = useMemo(() => {
    const rows = [...(q.data ?? [])];
    rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return rows;
  }, [q.data]);

  const createM = useMutation({
    mutationFn: async () => {
      const body: { title: string; due_date?: string } = { title: title.trim() };
      if (due.trim()) body.due_date = due.trim();
      const r = await fetch("/api/me/milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("create");
      return r.json();
    },
    onSuccess: async () => {
      setTitle("");
      setDue("");
      await qc.invalidateQueries({ queryKey: queryKeys.milestones });
    },
  });

  const patchM = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/me/milestones/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("patch");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.milestones });
    },
  });

  return (
    <ProductPageChrome
      title="Career steps"
      description="Your milestone roadmap. Start from Career pathfinder for persona-aware context, then break outcomes into trackable steps here."
    >
      <CareerFlowProgress
        steps={["Profile", "Pathfinder", "Career Steps", "Planner"]}
        active="Career Steps"
        value={66}
      />

      <div className="mb-6 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
        <span className="font-medium text-[var(--app-text-primary)]">Plan, then apply:</span> refine direction in{" "}
        <Link href="/app/pathfinder" className="font-medium text-[var(--app-accent)] hover:underline">
          Career pathfinder
        </Link>
        , find roles in{" "}
        <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] hover:underline">
          Job discovery
        </Link>
        , and review drafts in{" "}
        <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] hover:underline">
          Approvals
        </Link>
        .
      </div>

      <div className="mb-6 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 shadow-[var(--app-shadow-0)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Add milestone
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-[12px] font-medium text-[var(--app-text-secondary)]">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
              placeholder="e.g. Complete system design course"
            />
          </label>
          <label className="w-full text-[12px] font-medium text-[var(--app-text-secondary)] sm:w-44">
            Due (optional)
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            />
          </label>
          <AppButton
            type="button"
            variant="primary"
            disabled={!title.trim() || createM.isPending}
            onClick={() => createM.mutate()}
            className="shrink-0 justify-center"
          >
            {createM.isPending ? "Adding…" : "Add"}
          </AppButton>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading roadmap…</p>
      ) : q.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load milestones.</p>
      ) : sorted.length === 0 ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">
          No milestones yet. Add your first step above — for example after using{" "}
          <Link href="/app/pathfinder" className="font-medium text-[var(--app-accent)] hover:underline">
            Career pathfinder
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-0">
          {sorted.map((m, idx) => {
            const pill = statusPill(m.status);
            const circ = circleFor(m.status, idx);
            const isLast = idx === sorted.length - 1;
            const active = m.status.toLowerCase() === "in_progress" || m.status.toLowerCase() === "doing";
            return (
              <div key={m.id} className="flex gap-3">
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${circ.className}`}
                  >
                    {circ.content}
                  </div>
                  {!isLast ? <div className="mt-1 w-px flex-1 min-h-[24px] bg-[var(--app-border)]" /> : null}
                </div>
                <div
                  className={`mb-4 flex-1 rounded-[20px] border bg-[var(--app-bg-elevated)] p-4 shadow-[var(--app-shadow-0)] ${
                    active ? "border-[var(--app-accent)]" : "border-[var(--app-border)]"
                  } ${m.status.toLowerCase() === "done" || m.status.toLowerCase() === "completed" ? "" : "opacity-100"}`}
                  style={
                    m.status.toLowerCase() === "todo" || m.status.toLowerCase() === "upcoming"
                      ? { opacity: 0.92 }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-[15px] font-medium text-[var(--app-text-primary)]">{m.title}</div>
                    <span className={`shrink-0 rounded-[var(--app-radius-pill)] px-2 py-0.5 text-[11px] font-medium ${pill.className}`}>
                      {pill.label}
                    </span>
                  </div>
                  {m.due_date ? (
                    <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">Due {m.due_date}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="text-[11px] text-[var(--app-text-tertiary)]">
                      Status
                      <select
                        className="ml-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-2 py-1 text-[12px] text-[var(--app-text-primary)]"
                        value={m.status}
                        onChange={(e) => patchM.mutate({ id: m.id, status: e.target.value })}
                        disabled={patchM.isPending}
                      >
                        <option value="todo">Upcoming</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ProductPageChrome>
  );
}
