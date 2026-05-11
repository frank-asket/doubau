"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/query-keys";

import { WorkspaceInsightsPanel } from "./WorkspaceInsightsPanel";
import { ProductPageChrome } from "./ProductPageChrome";

type MetricsPayload = {
  window_days?: number;
  by_event_type?: Record<string, number>;
};

type CheckInRow = {
  id: string;
  mood: number;
  energy: number | null;
  workload: number | null;
  notes: string | null;
  created_at: string;
};

function Likert({
  label,
  value,
  onChange,
  showClear = true,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  showClear?: boolean;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--app-text-secondary)]">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`min-h-[36px] min-w-[36px] rounded-md border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${
              value === n
                ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
                : "border-[var(--app-border)] bg-[var(--app-bg-page)] text-[var(--app-text-secondary)] hover:border-[var(--app-accent)]"
            }`}
          >
            {n}
          </button>
        ))}
        {showClear ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-transparent px-2 text-[12px] text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)]"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CareerHealthClient() {
  const qc = useQueryClient();
  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState<number | null>(null);
  const [workload, setWorkload] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const metricsQ = useQuery({
    queryKey: ["match-metrics", 14],
    queryFn: async () => {
      const r = await fetch("/api/me/match/metrics?days=14", { cache: "no-store" });
      if (!r.ok) throw new Error("metrics");
      return r.json() as Promise<MetricsPayload>;
    },
  });

  const checkInsQ = useQuery({
    queryKey: queryKeys.checkIns,
    queryFn: async () => {
      const r = await fetch("/api/me/check-ins?limit=60", { cache: "no-store" });
      if (!r.ok) throw new Error("check-ins");
      return r.json() as Promise<CheckInRow[]>;
    },
  });

  const saveCheckIn = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/check-ins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mood,
          energy,
          workload,
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) {
        const msg =
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
              ? JSON.stringify(body.detail)
              : `Save failed (${r.status})`;
        throw new Error(msg);
      }
      return body as CheckInRow;
    },
    onSuccess: async () => {
      setNotes("");
      await qc.invalidateQueries({ queryKey: queryKeys.checkIns });
    },
  });

  const streak = useMemo(() => {
    const rows = checkInsQ.data ?? [];
    if (rows.length === 0) return 0;
    const days = new Set<string>();
    for (const r of rows) {
      const d = new Date(r.created_at);
      if (!Number.isNaN(d.getTime())) {
        days.add(d.toDateString());
      }
    }
    let count = 0;
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    for (let i = 0; i < 120; i++) {
      if (days.has(cursor.toDateString())) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [checkInsQ.data]);

  return (
    <ProductPageChrome
      title="Career health"
      description="Reflect on how your search is going and connect your check-ins with application progress."
    >
      <WorkspaceInsightsPanel intro="Operational health is the combination of mindset, velocity in the product, and discovery engagement." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Daily check-in
            </div>
            <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
              Mood is required; energy and workload are optional. Your history appears below so you can spot patterns over time.
            </p>
          </div>

          <Likert label="Mood (1 = low, 5 = great)" value={mood} onChange={(v) => setMood(v ?? 3)} showClear={false} />

          <Likert label="Energy (optional)" value={energy} onChange={setEnergy} />

          <Likert label="Workload / pressure (optional)" value={workload} onChange={setWorkload} />

          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Notes (optional)
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[88px]"
              placeholder="One line on what shifted today…"
              maxLength={4000}
            />
          </label>

          <AppButton
            type="button"
            disabled={saveCheckIn.isPending}
            onClick={() => saveCheckIn.mutate()}
            className="w-full justify-center sm:w-auto"
          >
            {saveCheckIn.isPending ? "Saving…" : "Save check-in"}
          </AppButton>
          {saveCheckIn.isError ? (
            <p className="text-[13px] text-[var(--app-badge-red-fg)]" role="alert">
              {saveCheckIn.error instanceof Error ? saveCheckIn.error.message : "Could not save."}
            </p>
          ) : null}
        </div>

        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Check-in streak
          </div>
          <p className="mt-2 tabular-nums text-[36px] font-semibold text-[var(--app-text-primary)]">{streak}</p>
          <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
            Consecutive days with at least one saved check-in (client-side from your history).
          </p>
        </div>
      </div>

      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Discovery engagement (14d)
        </div>
        {metricsQ.isLoading ? (
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">Loading metrics…</p>
        ) : metricsQ.isError ? (
          <p className="mt-2 text-[13px] text-[var(--app-badge-red-fg)]">Could not load match metrics.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-[13px] text-[var(--app-text-secondary)]">
            {Object.entries(metricsQ.data?.by_event_type ?? {}).length === 0 ? (
              <li>No discovery events in this window yet.</li>
            ) : (
              Object.entries(metricsQ.data?.by_event_type ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span className="font-mono text-[12px]">{k}</span>
                    <span className="tabular-nums font-medium text-[var(--app-text-primary)]">{n}</span>
                  </li>
                ))
            )}
          </ul>
        )}
      </div>

      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Recent check-ins
        </div>
        {checkInsQ.isLoading ? (
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">Loading…</p>
        ) : checkInsQ.isError ? (
          <p className="mt-2 text-[13px] text-[var(--app-badge-red-fg)]">Could not load check-ins.</p>
        ) : (checkInsQ.data ?? []).length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">No entries yet — add your first check-in above.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(checkInsQ.data ?? []).map((row) => (
              <li
                key={row.id}
                className="border-b border-[var(--app-border)] pb-3 text-[13px] text-[var(--app-text-secondary)] last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--app-text-primary)]">
                    {new Date(row.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="tabular-nums text-[12px]">
                    mood {row.mood}
                    {row.energy != null ? ` · energy ${row.energy}` : ""}
                    {row.workload != null ? ` · workload ${row.workload}` : ""}
                  </span>
                </div>
                {row.notes ? <p className="mt-1 text-pretty">{row.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProductPageChrome>
  );
}
