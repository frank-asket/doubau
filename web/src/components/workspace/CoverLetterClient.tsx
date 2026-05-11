"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { fetchApplications, fetchDrafts } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";

import { ProductPageChrome } from "./ProductPageChrome";

export function CoverLetterClient() {
  const draftsQ = useQuery({
    queryKey: queryKeys.applicationDrafts,
    queryFn: fetchDrafts,
  });
  const appsQ = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
  });

  const appById = new Map((appsQ.data ?? []).map((a) => [a.id, a]));
  const emailDrafts = (draftsQ.data ?? []).filter((d) => d.channel === "email");

  return (
    <ProductPageChrome
      title="Cover letter"
      description="Email-channel drafts from your applications pipeline (same source as the Approval dashboard)."
    >
      {draftsQ.isLoading || appsQ.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading drafts…</p>
      ) : draftsQ.isError || appsQ.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load drafts.</p>
      ) : emailDrafts.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] text-[var(--app-text-secondary)]">
          No email drafts yet. Generate drafts from{" "}
          <Link href="/app/tracker" className="font-medium text-[var(--app-accent)] hover:underline">
            applications
          </Link>{" "}
          or the approvals flow.
        </div>
      ) : (
        <ul className="space-y-3">
          {emailDrafts.map((d) => {
            const app = appById.get(d.application_id);
            return (
              <li
                key={d.id}
                className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[14px] font-medium text-[var(--app-text-primary)]">
                    {app ? `${app.company} — ${app.job_title}` : "Application"}
                  </div>
                  <Link
                    href="/app/approvals"
                    className="text-[12px] font-medium text-[var(--app-accent)] hover:underline"
                  >
                    Open approvals →
                  </Link>
                </div>
                <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
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
