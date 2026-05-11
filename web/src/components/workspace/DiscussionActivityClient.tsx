"use client";

import { useQuery } from "@tanstack/react-query";

import { ProductPageChrome } from "./ProductPageChrome";

type MatchEventRow = {
  id: string;
  job_id: string;
  event_type: string;
  reason: string | null;
  meta: unknown;
  created_at: string;
};

export function DiscussionActivityClient() {
  const q = useQuery({
    queryKey: ["match-events-discussion", 80],
    queryFn: async () => {
      const r = await fetch("/api/me/match/events?limit=80", { cache: "no-store" });
      if (!r.ok) throw new Error("events");
      return r.json() as Promise<MatchEventRow[]>;
    },
  });

  return (
    <ProductPageChrome
      title="Discussion board"
      description="Activity timeline from discovery interactions (match events). A lightweight feed you can review alongside approvals — not a threaded forum."
    >
      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading activity…</p>
      ) : q.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load events.</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">
          No events yet — interact with roles in Job discovery to populate this timeline.
        </p>
      ) : (
        <ul className="space-y-2">
          {(q.data ?? []).map((ev) => {
            const when = new Date(ev.created_at);
            const label = when.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li
                key={ev.id}
                className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 text-[13px]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-[var(--app-text-tertiary)]">{label}</span>
                  <span className="rounded-md bg-[var(--app-bg-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--app-text-secondary)]">
                    {ev.event_type}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
                  Job <span className="font-mono text-[11px]">{ev.job_id.slice(0, 8)}…</span>
                  {ev.reason ? ` · ${ev.reason}` : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ProductPageChrome>
  );
}
