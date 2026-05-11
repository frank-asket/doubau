"use client";

import Link from "next/link";

import { useWorkspaceSummary } from "@/hooks/useWorkspaceSummary";

import { AppBadge } from "@/components/ui/badge";

export function WorkspaceInsightsPanel({ intro }: { intro?: string }) {
  const q = useWorkspaceSummary();

  if (q.isLoading) {
    return (
      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] text-[var(--app-text-secondary)]">
        Loading workspace signals…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] text-[var(--app-text-secondary)]">
        {q.error instanceof Error ? q.error.message : "Could not load workspace summary."}
      </div>
    );
  }

  const s = q.data;
  if (!s) return null;

  const statusEntries = Object.entries(s.applications_by_status || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {intro ? (
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{intro}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Résumé
          </div>
          <div className="mt-1 text-[15px] font-medium text-[var(--app-text-primary)]">
            {s.resume_status ?? "Not uploaded"}
          </div>
          <p className="mt-2 text-[12px] text-[var(--app-text-secondary)]">
            {s.resume_status === "EMBEDDED" || s.resume_status === "PARSED"
              ? "Ready for discovery and fit scoring."
              : "Upload in onboarding or replace from your dashboard flow."}
          </p>
        </div>

        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Applications
          </div>
          <div className="mt-1 text-[15px] font-medium text-[var(--app-text-primary)]">{s.applications_total}</div>
          <p className="mt-2 text-[12px] text-[var(--app-text-secondary)]">Roles in your DouBow pipeline.</p>
        </div>

        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Pending approval
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[15px] font-medium text-[var(--app-text-primary)]">{s.pending_approval_count}</span>
            {s.pending_approval_count > 0 ? (
              <AppBadge variant="amber">Needs you</AppBadge>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] text-[var(--app-text-secondary)]">
            Drafts waiting in{" "}
            <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] hover:underline">
              approvals
            </Link>
            .
          </p>
        </div>
      </div>

      {statusEntries.length > 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Pipeline mix
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {statusEntries.map(([k, n]) => (
              <li key={k}>
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--app-bg-muted)] px-2 py-1 text-[11px] text-[var(--app-text-secondary)]">
                  <span className="font-mono text-[10px]">{k}</span>
                  <span className="font-medium text-[var(--app-text-primary)]">{n}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-[12px]">
        <Link
          href="/app/discovery"
          className="rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text-primary)]"
        >
          Job discovery
        </Link>
        <Link
          href="/app/tracker"
          className="rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text-primary)]"
        >
          Tracker
        </Link>
        <Link
          href="/app/approvals"
          className="rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text-primary)]"
        >
          Approvals
        </Link>
      </div>
    </div>
  );
}
