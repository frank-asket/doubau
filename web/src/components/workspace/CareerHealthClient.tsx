"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppButton } from "@/components/ui/button";
import {
  avg,
  goodDayStreak,
  moodSeriesLastN,
  type CheckInDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { MetricCard, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const MOODS = [
  { label: "Terrible", value: 1 },
  { label: "Bad", value: 2 },
  { label: "Neutral", value: 3 },
  { label: "Good", value: 4 },
  { label: "Great", value: 5 },
];

export function CareerHealthClient() {
  const qc = useQueryClient();
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(3);
  const [workload, setWorkload] = useState(3);
  const [notes, setNotes] = useState("");

  const q = useQuery({
    queryKey: queryKeys.checkIns,
    queryFn: async () => {
      const r = await fetch("/api/me/check-ins?limit=120", { cache: "no-store" });
      if (!r.ok) throw new Error("check-ins");
      return r.json() as CheckInDto[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (mood == null) throw new Error("mood");
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
      if (!r.ok) throw new Error("save");
      return r.json();
    },
    onSuccess: async () => {
      setNotes("");
      setMood(null);
      await qc.invalidateQueries({ queryKey: queryKeys.checkIns });
    },
  });

  const rows = q.data ?? [];
  const moods = rows.map((c) => c.mood).filter((m): m is number => m != null);
  const energies = rows.map((c) => c.energy).filter((m): m is number => m != null);
  const workloads = rows.map((c) => c.workload).filter((m): m is number => m != null);

  const avgMood = avg(moods);
  const avgEnergy = avg(energies);
  const avgWorkload = avg(workloads);
  const streak = goodDayStreak(rows, 4);
  const series = useMemo(() => moodSeriesLastN(rows, 14), [q.data]);

  const recentLowMood = moods.length >= 3 && avgMood != null && avgMood < 3.2;

  return (
    <ProductPageChrome title="Career Health">
      <div className="grid gap-4 xl:grid-cols-[2fr_1.25fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              title="Good-day streak"
              value={String(streak)}
              unit="(days)"
              delta={streak ? `≥ mood 4` : undefined}
              tone="green"
              icon="check-circle"
            >
              Consecutive UTC days (from today) where you logged mood ≥ 4. Log daily check-ins to grow this streak.
            </MetricCard>
            <MetricCard
              title="Energy (avg)"
              value={avgEnergy != null ? `${Math.round(avgEnergy * 20)}%` : "—"}
              unit=""
              tone={avgEnergy != null && avgEnergy < 2.5 ? "red" : "green"}
              icon="analytics"
            >
              Average of your last {energies.length} energy ratings (1–5 scale, shown as %).
            </MetricCard>
            <MetricCard
              title="Mood (avg)"
              value={avgMood != null ? avgMood.toFixed(1) : "—"}
              unit="(1–5)"
              tone={recentLowMood ? "red" : "green"}
              icon="message-circle"
            >
              Rolling average from saved check-ins.
            </MetricCard>
            <MetricCard
              title="Workload (avg)"
              value={avgWorkload != null ? `${Math.round(avgWorkload * 20)}%` : "—"}
              unit=""
              icon="briefcase"
            >
              Higher means heavier reported workload (1–5).
            </MetricCard>
          </div>

          <section className="ch-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[20px] font-bold">Mood trend</h2>
              <Tag>Last 14 days</Tag>
            </div>
            {q.isLoading ? (
              <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">Loading check-ins…</p>
            ) : (
              <div className="mt-6 flex flex-wrap gap-2">
                {series.map((pt) => (
                  <div key={pt.label} className="flex flex-col items-center gap-1">
                    <div
                      className="h-16 w-6 rounded-md bg-[var(--app-bg-muted)]"
                      title={pt.mood != null ? `Mood ${pt.mood}` : "No entry"}
                    >
                      {pt.mood != null ? (
                        <div
                          className="w-full rounded-md bg-[var(--app-accent)]"
                          style={{ height: `${(pt.mood / 5) * 100}%`, marginTop: "auto" }}
                        />
                      ) : null}
                    </div>
                    <span className="text-[10px] text-[var(--app-text-tertiary)]">{pt.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <article className="ch-soft-card p-5">
                <div className="flex justify-between">
                  <h3 className="font-bold">Job satisfaction (proxy)</h3>
                </div>
                <p className="mt-3 text-[13px] text-[var(--app-text-secondary)]">
                  Derived from average mood vs workload when both are logged — informational only, not clinical advice.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-[30px] font-bold tabular-nums">
                    {avgMood != null && avgWorkload != null
                      ? Math.round(Math.min(100, Math.max(0, (avgMood / 5) * 100 - (avgWorkload - 3) * 8)))
                      : "—"}
                  </span>
                  <Tag>{recentLowMood ? "Watch" : "Stable"}</Tag>
                </div>
              </article>
              <article className="ch-soft-card p-5">
                <h3 className="font-bold">Signals</h3>
                <ul className="mt-3 space-y-2 text-[13px] text-[var(--app-text-secondary)]">
                  <li>- {rows.length} check-ins stored</li>
                  <li>- {recentLowMood ? "Recent mood trend is soft — consider lighter goals this week." : "Keep logging for richer trends."}</li>
                </ul>
              </article>
            </div>
          </section>
        </div>

        <aside className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Daily career check-in</h2>
          <p className="mt-6 font-semibold">How are you feeling about work today?</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                  mood === m.value
                    ? "border-[var(--app-accent)] bg-[var(--app-blue-50)] text-[var(--app-accent)]"
                    : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="my-6 border-t border-[var(--app-border)]" />
          <div className="mb-7">
            <div className="flex justify-between font-semibold">
              <span>Energy level</span>
              <span className="text-[var(--app-accent)] tabular-nums">({energy}/5)</span>
            </div>
            <input
              className="mt-4 w-full accent-[var(--app-accent)]"
              type="range"
              min={1}
              max={5}
              step={1}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
            />
            <div className="mt-2 flex justify-between text-[13px] text-[var(--app-text-secondary)]">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          <div className="mb-7">
            <div className="flex justify-between font-semibold">
              <span>Workload</span>
              <span className="text-[var(--app-accent)] tabular-nums">({workload}/5)</span>
            </div>
            <input
              className="mt-4 w-full accent-[var(--app-accent)]"
              type="range"
              min={1}
              max={5}
              step={1}
              value={workload}
              onChange={(e) => setWorkload(Number(e.target.value))}
            />
            <div className="mt-2 flex justify-between text-[13px] text-[var(--app-text-secondary)]">
              <span>Light</span>
              <span>Heavy</span>
            </div>
          </div>
          <label className="mt-4 block font-semibold">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-3 min-h-28 w-full rounded-2xl border border-[var(--app-border)] p-4 text-[14px] outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
              placeholder="Short reflection…"
            />
          </label>
          <AppButton
            type="button"
            variant="primary"
            className="mt-6 w-full justify-center"
            disabled={mood == null || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Saving…" : "Save today’s check-in"}
          </AppButton>
          {submit.isError ? (
            <p className="mt-3 text-[12px] text-[var(--app-badge-red-fg)]">Could not save — try again.</p>
          ) : null}
        </aside>
      </div>
    </ProductPageChrome>
  );
}
