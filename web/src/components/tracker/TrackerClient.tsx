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
  const total = sorted.length;
  const pending = sorted.filter((app) => app.status === "PENDING_APPROVAL").length;
  const submitted = sorted.filter((app) => app.status === "SUBMITTED").length;

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <section className="app-surface rounded-[var(--app-radius-lg)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Application pipeline
            </div>
            <h1 className="mt-1 text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
              Job Tracker
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
              Keep every opportunity organized from first draft to submitted application.
            </p>
          </div>
          <div className="grid w-full max-w-xl grid-cols-3 gap-2 lg:w-[420px]">
            {[
              ["Total", total],
              ["Review", pending],
              ["Submitted", submitted],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[var(--app-radius-md)] bg-[var(--app-bg-muted)] px-3 py-2 shadow-[inset_0_0_0_0.5px_var(--app-border)]">
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">{label}</div>
                <div className="mt-1 tabular-nums text-[18px] font-semibold leading-none text-[var(--app-text-primary)]">{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
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
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-4 text-[13px] font-medium leading-5 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-accent-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]"
          >
            Approval dashboard
          </Link>
        </div>
      </section>

      {error ? (
        <div
          className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--app-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="app-surface overflow-x-auto rounded-[var(--app-radius-lg)]">
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
                    Draft approvals
                  </Link>{" "}
                  or start from a role in Find jobs.
                </td>
              </tr>
            ) : null}
            {sorted.map((app) => {
              const { variant, label } = applicationStatusBadge(app.status);
              const shortId = `${app.id.slice(0, 8)}…`;
              return (
                <tr
                  key={app.id}
                  className="border-b border-[var(--app-border)] font-[family-name:var(--font-app-mono)] transition-colors hover:bg-[var(--app-bg-muted)] last:border-0"
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
