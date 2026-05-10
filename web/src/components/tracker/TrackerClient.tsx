"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import { useApplicationsPipelineWs } from "@/hooks/useApplicationsPipelineWs";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import { fetchApplications } from "@/lib/applications-fetch";
import { applicationStatusBadge } from "@/lib/application-status";
import { queryKeys } from "@/lib/query-keys";

/** Fallback polling; pipeline WebSocket invalidates this query when possible. */
const APPLICATIONS_POLL_MS = 60_000;

function statusOrder(s: string): number {
  const order: Record<string, number> = {
    PENDING_APPROVAL: 0,
    APPROVED: 1,
    DRAFTED: 2,
    SCORING: 3,
    DISCOVERED: 4,
    SUBMITTED: 5,
    FAILED: 6,
    RETRY: 7,
  };
  return order[s] ?? 99;
}

export function TrackerClient() {
  useApplicationsPipelineWs(true);

  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
    refetchInterval: APPLICATIONS_POLL_MS,
  });

  const loading = applicationsQuery.isLoading;
  const error = applicationsQuery.isError ? "Could not load applications." : null;

  const sorted = useMemo(() => {
    const rows = applicationsQuery.data ?? [];
    return [...rows].sort((a, b) => {
      const oa = statusOrder(a.status);
      const ob = statusOrder(b.status);
      if (oa !== ob) return oa - ob;
      return `${a.company} ${a.job_title}`.localeCompare(`${b.company} ${b.job_title}`);
    });
  }, [applicationsQuery.data]);

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
            Job Tracker
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
            Pipeline view for every application. IDs and status columns use a compact mono rhythm for scanning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppButton
            disabled={loading || applicationsQuery.isFetching}
            size="md"
            variant="outline"
            type="button"
            onClick={() => void applicationsQuery.refetch()}
          >
            Refresh
          </AppButton>
          <Link
            href="/app/approvals"
            className="inline-flex cursor-pointer items-center justify-center rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-4 py-[7px] text-[13px] font-medium leading-5 text-white transition-colors hover:bg-[var(--app-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]"
          >
            Approval dashboard
          </Link>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--app-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--app-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              <th className="px-4 py-3 font-medium">Application</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">ID</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 font-[family-name:var(--font-app-sans)] text-[13px] text-[var(--app-text-secondary)]"
                >
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading && sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 font-[family-name:var(--font-app-sans)] text-[13px] text-[var(--app-text-secondary)]"
                >
                  No applications yet. Create one from{" "}
                  <Link className="font-semibold text-[var(--app-accent)]" href="/app/approvals">
                    Approval dashboard
                  </Link>{" "}
                  (demo draft) or connect discovery flows.
                </td>
              </tr>
            ) : null}
            {sorted.map((app) => {
              const { variant, label } = applicationStatusBadge(app.status);
              const shortId = `${app.id.slice(0, 8)}…`;
              return (
                <tr
                  key={app.id}
                  className="border-b border-[var(--app-border)] font-[family-name:var(--font-app-mono)] last:border-0"
                >
                  <td className="max-w-[220px] px-4 py-3 align-top font-medium text-[var(--app-text-primary)]">
                    <span className="font-[family-name:var(--font-app-sans)]">{app.job_title}</span>
                  </td>
                  <td className="px-4 py-3 align-top text-[var(--app-text-secondary)]">{app.company}</td>
                  <td className="px-4 py-3 align-top font-[family-name:var(--font-app-sans)]">
                    <AppBadge variant={variant}>{label}</AppBadge>
                  </td>
                  <td className="max-w-[180px] px-4 py-3 align-top">
                    {app.source_url ? (
                      <a
                        href={app.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-[11px] text-[var(--app-accent)] hover:underline"
                      >
                        {(() => {
                          try {
                            return new URL(app.source_url).hostname;
                          } catch {
                            return "link";
                          }
                        })()}
                      </a>
                    ) : (
                      <span className="text-[var(--app-text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-[11px] text-[var(--app-text-tertiary)]">
                    {shortId}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
