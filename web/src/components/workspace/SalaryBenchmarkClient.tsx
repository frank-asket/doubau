"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { FeedRow } from "@/components/discovery/DiscoveryClient";

import { ProductPageChrome } from "./ProductPageChrome";

export function SalaryBenchmarkClient() {
  const q = useQuery({
    queryKey: ["jobs-feed-benchmark", 30],
    queryFn: async () => {
      const r = await fetch("/api/jobs/feed?limit=30", { cache: "no-store" });
      const data = (await r.json().catch(() => ({}))) as FeedRow[] | { detail?: string };
      if (!r.ok) {
        const detail = typeof (data as { detail?: string }).detail === "string" ? (data as { detail: string }).detail : null;
        throw new Error(detail ?? `Feed request failed (${r.status}).`);
      }
      return data as FeedRow[];
    },
  });

  return (
    <ProductPageChrome
      title="Salary benchmark"
      description="Listings in DouBow do not yet carry structured salary fields. Use your personalized feed as a live sample of roles and match scores, then research compensation externally for those titles."
    >
      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading feed snapshot…</p>
      ) : q.isError ? (
        <p className="text-pretty text-[13px] leading-relaxed text-[var(--app-badge-red-fg)]">
          {q.error instanceof Error ? q.error.message : "Could not load job feed."}
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--app-text-secondary)]">
            Showing top personalized rows from{" "}
            <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] hover:underline">
              Job discovery
            </Link>
            . Match % reflects embedding similarity + blending — not salary data.
          </p>
          <ul className="space-y-2">
            {(q.data ?? []).slice(0, 15).map((row) => (
              <li
                key={row.job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3"
              >
                <div>
                  <div className="text-[14px] font-medium text-[var(--app-text-primary)]">{row.job.title}</div>
                  <div className="text-[12px] text-[var(--app-text-secondary)]">
                    {row.job.company}
                    {row.job.location ? ` · ${row.job.location}` : ""}
                  </div>
                </div>
                <div className="tabular-nums text-[13px] font-semibold text-[var(--app-text-primary)]">
                  Match {Math.round(row.score)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ProductPageChrome>
  );
}
