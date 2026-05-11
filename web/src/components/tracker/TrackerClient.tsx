"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const PIPELINE_COLUMNS = [
  { id: "DISCOVERED", title: "Saved", description: "Roles you have added or started from." },
  { id: "PENDING_APPROVAL", title: "Review", description: "Drafts waiting for your sign-off." },
  { id: "APPROVED", title: "Ready", description: "Approved outreach, not submitted yet." },
  { id: "SUBMITTED", title: "Submitted", description: "Outreach has been sent or queued." },
  { id: "FAILED", title: "Closed", description: "Rejected, failed, or parked for later." },
];

export function TrackerClient() {
  useApplicationsPipelineWs(true);

  const qc = useQueryClient();

  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
    refetchInterval: APPLICATIONS_POLL_MS,
  });

  const generateDraftM = useMutation({
    mutationFn: async (appId: string) => {
      const resp = await fetch(`/api/applications/${appId}/generate_draft`, { method: "POST" });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { detail?: string };
        throw new Error(typeof data.detail === "string" ? data.detail : "Could not generate outreach.");
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.applications }),
        qc.invalidateQueries({ queryKey: queryKeys.applicationDrafts }),
      ]);
    },
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
  const byColumn = useMemo(() => {
    const groups = new Map<string, typeof sorted>();
    for (const column of PIPELINE_COLUMNS) groups.set(column.id, []);
    for (const app of sorted) {
      const key = app.status === "RETRY" ? "FAILED" : app.status;
      const bucket = groups.get(key) ?? groups.get("DISCOVERED");
      bucket?.push(app);
    }
    return groups;
  }, [sorted]);
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

      {generateDraftM.isError ? (
        <div
          className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--app-danger)]"
          role="alert"
        >
          {generateDraftM.error instanceof Error ? generateDraftM.error.message : "Could not generate outreach."}
        </div>
      ) : null}

      {loading ? (
        <div className="app-surface rounded-[var(--app-radius-lg)] p-6 text-[13px] text-[var(--app-text-secondary)]">
          Loading applications…
        </div>
      ) : null}

      {!loading && sorted.length === 0 ? (
        <div className="app-surface rounded-[var(--app-radius-lg)] border-dashed px-5 py-10 text-center">
          <p className="text-[14px] font-semibold text-[var(--app-text-primary)]">No applications yet</p>
          <p className="mx-auto mt-2 max-w-md text-pretty text-[13px] leading-6 text-[var(--app-text-secondary)]">
            Start from a role in Find jobs, generate outreach, and the application will move through this board.
          </p>
          <Link className="mt-5 inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 text-[13px] font-medium text-white hover:bg-[var(--app-accent-hover)]" href="/app/discovery">
            Find jobs
          </Link>
        </div>
      ) : null}

      {!loading && sorted.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-5">
          {PIPELINE_COLUMNS.map((column) => {
            const rows = byColumn.get(column.id) ?? [];
            return (
              <section key={column.id} className="min-h-[220px] rounded-[var(--app-radius-lg)] bg-[var(--app-bg-muted)] p-3 shadow-[inset_0_0_0_0.5px_var(--app-border)]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[13px] font-semibold text-[var(--app-text-primary)]">{column.title}</h2>
                    <p className="mt-1 text-[11px] leading-4 text-[var(--app-text-tertiary)]">{column.description}</p>
                  </div>
                  <span className="rounded-[var(--app-radius-pill)] bg-[var(--app-bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-secondary)] shadow-[inset_0_0_0_0.5px_var(--app-border)]">
                    {rows.length}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {rows.map((app) => {
                    const { variant, label } = applicationStatusBadge(app.status);
                    return (
                      <article key={app.id} className="rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--app-text-primary)]">{app.job_title}</h3>
                            <p className="mt-1 truncate text-[12px] text-[var(--app-text-secondary)]">{app.company}</p>
                          </div>
                          <AppBadge variant={variant}>{label}</AppBadge>
                        </div>
                        {app.source_url ? (
                          <a href={app.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 block truncate text-[11px] font-medium text-[var(--app-accent)] hover:underline">
                            {(() => {
                              try {
                                return new URL(app.source_url).hostname;
                              } catch {
                                return "Original posting";
                              }
                            })()}
                          </a>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {app.status === "DISCOVERED" || app.status === "RETRY" ? (
                            <AppButton
                              disabled={generateDraftM.isPending}
                              size="sm"
                              variant="primary"
                              type="button"
                              onClick={() => generateDraftM.mutate(app.id)}
                            >
                              Generate outreach
                            </AppButton>
                          ) : null}
                          {app.status === "PENDING_APPROVAL" || app.status === "APPROVED" ? (
                            <Link className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-3 text-[12px] font-medium text-[var(--app-text-primary)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]" href="/app/approvals">
                              Review draft
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                  {rows.length === 0 ? (
                    <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-dashed border-[var(--app-border)] px-3 py-6 text-center text-[12px] text-[var(--app-text-tertiary)]">
                      Nothing here yet.
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
