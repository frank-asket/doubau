"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { FeedRow } from "@/components/discovery/DiscoveryClient";

import { ProductPageChrome } from "./ProductPageChrome";

const SPONSOR_HINT = /sponsor|visa|cos|skilled worker|right to work|immigration|tier 2|tier 5|global talent/i;

function rowMentionsSponsor(row: FeedRow): boolean {
  const blob = [
    row.job.title,
    row.job.company,
    row.job.description ?? "",
    ...(row.job.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return SPONSOR_HINT.test(blob);
}

export function SponsorshipHubClient() {
  const q = useQuery({
    queryKey: ["jobs-feed-sponsor", 60],
    queryFn: async () => {
      const r = await fetch("/api/jobs/feed?limit=60", { cache: "no-store" });
      const data = (await r.json().catch(() => ({}))) as FeedRow[] | { detail?: string };
      if (!r.ok) {
        const detail = typeof (data as { detail?: string }).detail === "string" ? (data as { detail: string }).detail : null;
        throw new Error(detail ?? `Feed request failed (${r.status}).`);
      }
      return data as FeedRow[];
    },
  });

  const filtered = useMemo(() => (q.data ?? []).filter(rowMentionsSponsor), [q.data]);

  return (
    <ProductPageChrome
      title="Sponsorship hub"
      description="Heuristic filter over your personalized feed for postings that mention sponsorship or visa-related language. Verify eligibility with employers — this is discovery support, not legal advice."
    >
      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading feed…</p>
      ) : q.isError ? (
        <p className="text-pretty text-[13px] leading-relaxed text-[var(--app-badge-red-fg)]">
          {q.error instanceof Error ? q.error.message : "Could not load job feed."}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] text-[var(--app-text-secondary)]">
          No obvious sponsorship keywords in the current feed slice. Try widening ingestion in{" "}
          <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] hover:underline">
            discovery
          </Link>{" "}
          or refine search providers on the API side.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => (
            <li
              key={row.job.id}
              className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3"
            >
              <div className="text-[14px] font-medium text-[var(--app-text-primary)]">{row.job.title}</div>
              <div className="text-[12px] text-[var(--app-text-secondary)]">
                {row.job.company}
                {row.job.location ? ` · ${row.job.location}` : ""}
              </div>
              {row.job.source_url ? (
                <a
                  href={row.job.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[12px] font-medium text-[var(--app-accent)] hover:underline"
                >
                  View listing
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ProductPageChrome>
  );
}
