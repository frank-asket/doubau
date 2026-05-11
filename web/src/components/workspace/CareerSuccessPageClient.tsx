"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { WorkspaceInsightsPanel } from "./WorkspaceInsightsPanel";
import { ProductPageChrome } from "./ProductPageChrome";

type MetricsPayload = {
  window_days?: number;
  by_event_type?: Record<string, number>;
};

export function CareerSuccessPageClient() {
  const metricsQ = useQuery({
    queryKey: ["match-metrics-success", 14],
    queryFn: async () => {
      const r = await fetch("/api/me/match/metrics?days=14", { cache: "no-store" });
      if (!r.ok) throw new Error("metrics");
      return r.json() as Promise<MetricsPayload>;
    },
  });

  const impressions =
    metricsQ.data?.by_event_type?.impression ??
    metricsQ.data?.by_event_type?.["impression"] ??
    0;

  return (
    <ProductPageChrome
      title="Career success"
      description="Combine pipeline totals from your workspace summary with discovery engagement from match metrics."
    >
      <WorkspaceInsightsPanel intro="Operational success starts with submitted applications and reviewed drafts — track both here." />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Feed impressions (14d)
          </div>
          <div className="mt-1 tabular-nums text-[28px] font-semibold text-[var(--app-text-primary)]">
            {metricsQ.isLoading ? "…" : impressions}
          </div>
          <p className="mt-2 text-[12px] text-[var(--app-text-secondary)]">
            From <span className="font-mono text-[11px] text-[var(--app-text-tertiary)]">GET /me/match/metrics</span> — see
            full charts in{" "}
            <Link href="/app/analytics" className="font-medium text-[var(--app-accent)] hover:underline">
              Match analytics
            </Link>
            .
          </p>
        </div>
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Drill down
          </div>
          <ul className="mt-2 space-y-1 text-[13px] text-[var(--app-text-secondary)]">
            <li>
              <Link href="/app/tracker" className="font-medium text-[var(--app-accent)] hover:underline">
                Tracker
              </Link>{" "}
              — submitted vs pending outcomes
            </li>
            <li>
              <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] hover:underline">
                Approvals
              </Link>{" "}
              — human-in-the-loop gate
            </li>
          </ul>
        </div>
      </div>
    </ProductPageChrome>
  );
}
