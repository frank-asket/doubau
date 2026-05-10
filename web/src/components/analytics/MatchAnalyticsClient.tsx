"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";

type MetricsPayload = {
  window_days?: number;
  by_event_type?: Record<string, number>;
  by_reason?: Record<string, number>;
};

type MatchEventRow = {
  id: string;
  job_id: string;
  event_type: string;
  reason: string | null;
  meta: unknown;
  created_at: string;
};

const WINDOW_OPTIONS = [7, 14, 30] as const;

function sortEntries(map: Record<string, number> | undefined): [string, number][] {
  if (!map) return [];
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function eventLabel(t: string): string {
  switch (t) {
    case "impression":
      return "Impressions";
    case "click_out":
      return "Outbound clicks";
    case "feedback_up":
      return "Upvotes";
    case "feedback_down":
      return "Downvotes";
    case "hide":
      return "Hidden";
    default:
      return t.replace(/_/g, " ");
  }
}

const API_401_SIGNED_IN =
  "The API rejected your token. Create a Clerk JWT template named \"doubow-api\" whose audience matches DOUBOW_CLERK_AUDIENCE in api/.env, and set DOUBOW_CLERK_JWKS_URL / ISSUER / AUDIENCE on the API.";

export function MatchAnalyticsClient() {
  const { isSignedIn, isLoaded } = useAuth();
  const [days, setDays] = useState<number>(14);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [events, setEvents] = useState<MatchEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, eRes] = await Promise.all([
        fetch(`/api/me/match/metrics?days=${d}`, { cache: "no-store" }),
        fetch(`/api/me/match/events?limit=40`, { cache: "no-store" }),
      ]);
      if (!mRes.ok) {
        if (mRes.status === 401) {
          setError(isLoaded && isSignedIn ? API_401_SIGNED_IN : "Sign in to view match analytics.");
        } else {
          setError("Could not load metrics.");
        }
        setMetrics(null);
      } else {
        setMetrics((await mRes.json()) as MetricsPayload);
      }
      if (eRes.ok) {
        setEvents((await eRes.json()) as MatchEventRow[]);
      } else {
        setEvents([]);
      }
    } catch {
      setError("Network error.");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const byType = sortEntries(metrics?.by_event_type);
  const maxType = useMemo(() => Math.max(1, ...byType.map(([, n]) => n)), [byType]);
  const byReason = sortEntries(metrics?.by_reason).slice(0, 8);

  const votesUp = metrics?.by_event_type?.feedback_up ?? 0;
  const votesDown = metrics?.by_event_type?.feedback_down ?? 0;
  const voteDenom = votesUp + votesDown;
  const downRatio = voteDenom > 0 ? votesDown / voteDenom : 0;
  const alertNegativeFeedback = voteDenom >= 5 && downRatio >= 0.45;
  const alertLowCtr =
    (metrics?.by_event_type?.impression ?? 0) >= 20 &&
    (metrics?.by_event_type?.click_out ?? 0) /
      Math.max(1, metrics?.by_event_type?.impression ?? 1) <
      0.02;

  return (
    <div className="flex flex-col gap-[var(--app-space-lg)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Window
          </div>
          <div className="mt-2 inline-flex rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-0.5">
            {WINDOW_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={
                  days === w
                    ? "rounded-[var(--app-radius-sm)] bg-[var(--app-bg-muted)] px-3 py-1.5 text-[13px] font-semibold text-[var(--app-text-primary)]"
                    : "rounded-[var(--app-radius-sm)] px-3 py-1.5 text-[13px] font-medium text-[var(--app-text-secondary)] transition-colors hover:text-[var(--app-text-primary)]"
                }
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <span className="text-[13px] text-[var(--app-text-tertiary)]">Loading…</span>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 text-[13px] text-[var(--app-text-secondary)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {(alertNegativeFeedback || alertLowCtr) && !error ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-amber-500/35 bg-amber-500/[0.07] px-4 py-3">
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-amber-700 dark:text-amber-400">
            Alerts
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            {alertNegativeFeedback ? (
              <li>
                Downvotes are a large share of feedback ({Math.round(downRatio * 100)}%). Consider refining your
                profile or filters.
              </li>
            ) : null}
            {alertLowCtr ? (
              <li>
                Very few clicks relative to impressions — titles may need sharper relevance signals, or try
                different sources.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-[var(--app-space-lg)] lg:grid-cols-2">
        <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
            Events by type
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            Counts in the last {metrics?.window_days ?? days} days.
          </p>
          <div className="mt-5 space-y-3">
            {byType.length === 0 && !loading ? (
              <p className="text-[13px] text-[var(--app-text-tertiary)]">No events in this window yet.</p>
            ) : null}
            {byType.map(([key, n]) => (
              <div key={key}>
                <div className="flex justify-between text-[12px] text-[var(--app-text-secondary)]">
                  <span>{eventLabel(key)}</span>
                  <span className="tabular-nums font-medium text-[var(--app-text-primary)]">{n}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.round((n / maxType) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
            Feedback reasons
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            Top reasons when users gave structured feedback.
          </p>
          <ul className="mt-4 space-y-2">
            {byReason.length === 0 && !loading ? (
              <li className="text-[13px] text-[var(--app-text-tertiary)]">No reason tags in this window.</li>
            ) : null}
            {byReason.map(([reason, n]) => (
              <li
                key={reason}
                className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] border-dashed pb-2 text-[13px] last:border-0 last:pb-0"
              >
                <span className="text-[var(--app-text-primary)]">{reason}</span>
                <span className="tabular-nums text-[var(--app-text-secondary)]">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
          Recent activity
        </h2>
        <p className="mt-1 text-[13px] text-[var(--app-text-secondary)]">
          Latest match-related events (newest first).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-[var(--app-text-tertiary)]">
                <th className="pb-2 pr-3 font-medium">When</th>
                <th className="pb-2 pr-3 font-medium">Event</th>
                <th className="pb-2 pr-3 font-medium">Reason</th>
                <th className="pb-2 font-medium font-[family-name:var(--font-app-mono)] text-[11px]">Job</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-app-mono)] text-[11px]">
              {events.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="py-6 text-[var(--app-text-tertiary)]">
                    No rows yet.
                  </td>
                </tr>
              ) : null}
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-[var(--app-border)] last:border-0">
                  <td className="py-2 pr-3 align-top text-[var(--app-text-secondary)]">
                    {new Date(ev.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3 align-top font-medium text-[var(--app-text-primary)]">
                    {eventLabel(ev.event_type)}
                  </td>
                  <td className="py-2 pr-3 align-top text-[var(--app-text-secondary)]">{ev.reason ?? "—"}</td>
                  <td className="py-2 align-top text-[var(--app-text-tertiary)]">{ev.job_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
