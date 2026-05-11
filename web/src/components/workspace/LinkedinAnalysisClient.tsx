"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { fetchApplications, fetchDrafts } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";

import { ProductPageChrome } from "./ProductPageChrome";

export function LinkedinAnalysisClient() {
  const draftsQ = useQuery({
    queryKey: queryKeys.applicationDrafts,
    queryFn: fetchDrafts,
  });
  const appsQ = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
  });

  const appById = new Map((appsQ.data ?? []).map((a) => [a.id, a]));
  const liDrafts = (draftsQ.data ?? []).filter((d) => d.channel === "linkedin");

  return (
    <ProductPageChrome
      title="LinkedIn analysis"
      description="LinkedIn outreach drafts generated with your applications (same dual-channel bundle as generate_draft)."
    >
      {draftsQ.isLoading || appsQ.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading drafts…</p>
      ) : draftsQ.isError || appsQ.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load drafts.</p>
      ) : liDrafts.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] text-[var(--app-text-secondary)]">
          No LinkedIn drafts yet. Generate drafts for an application, then review them in{" "}
          <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] hover:underline">
            approvals
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {liDrafts.map((d) => {
            const app = appById.get(d.application_id);
            return (
              <li
                key={d.id}
                className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4"
              >
                <div className="text-[14px] font-medium text-[var(--app-text-primary)]">
                  {app ? `${app.company} — ${app.job_title}` : "Application"}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
                  {d.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </ProductPageChrome>
  );
}
