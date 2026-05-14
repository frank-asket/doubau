"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useApplicationsPipelineRealtime } from "@/components/providers/ApplicationsPipelineRealtimeProvider";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import {
  createApplication,
  fetchApplications,
  fetchRoleReport,
  patchApplication,
  postFollowupDraft,
  postRoleReport,
  type ApplicationRow,
} from "@/lib/applications-fetch";
import { applicationStatusBadge } from "@/lib/application-status";
import { queryKeys } from "@/lib/query-keys";

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
  { id: "SUBMITTED", title: "Sent", description: "Your outreach left Doubow (Gmail or SMTP queue). This is your copy—not proof the employer read it." },
  { id: "FAILED", title: "Closed", description: "Rejected, failed, or parked for later." },
];

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseTagsInput(s: string): string[] | null {
  const parts = s
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 20) : null;
}

function followupLabel(iso: string | null | undefined): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const overdue = d.getTime() < Date.now();
  return {
    text: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    overdue,
  };
}

function TrackerRoleInsightBlock({ appId, appStatus }: { appId: string; appStatus: string }) {
  const qc = useQueryClient();
  const [sectionOpen, setSectionOpen] = useState(false);
  const reportQ = useQuery({
    queryKey: queryKeys.applicationRoleReport(appId),
    queryFn: () => fetchRoleReport(appId),
    enabled: sectionOpen,
    staleTime: 120_000,
  });
  const genM = useMutation({
    mutationFn: () => postRoleReport(appId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.applicationRoleReport(appId) }),
        qc.invalidateQueries({ queryKey: queryKeys.applications }),
        qc.invalidateQueries({ queryKey: queryKeys.applicationDetail(appId) }),
      ]);
    },
  });
  const followupM = useMutation({
    mutationFn: () => postFollowupDraft(appId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.applicationDrafts }),
        qc.invalidateQueries({ queryKey: queryKeys.applications }),
      ]);
    },
  });
  const canFollowup = appStatus !== "FAILED";
  const r = reportQ.data?.report;

  return (
    <details
      className="mt-3 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-3 py-2"
      onToggle={(e) => setSectionOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer select-none text-[12px] font-medium text-[var(--app-text-primary)]">
        Role insight report
      </summary>
      {sectionOpen ? (
        <div className="mt-3 space-y-3 border-t border-[var(--app-border)] pt-3">
          {reportQ.isLoading ? <p className="text-[12px] text-[var(--app-text-tertiary)]">Loading…</p> : null}
          {reportQ.isError ? (
            <p className="text-[12px] text-[var(--app-badge-red-fg)]" role="alert">
              Could not load report.
            </p>
          ) : null}
          {r && typeof r === "object" ? (
            <div className="space-y-3 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
              {"fit_score" in r && typeof r.fit_score === "number" ? (
                <p className="font-medium text-[var(--app-text-primary)]">
                  Fit score: {Math.round(r.fit_score)}
                  {"fit_match_pct" in r && typeof r.fit_match_pct === "number" ? (
                    <span className="font-normal text-[var(--app-text-tertiary)]">
                      {" "}
                      · Match {Math.round(r.fit_match_pct)}%
                    </span>
                  ) : null}
                </p>
              ) : null}
              {typeof r.role_summary === "string" ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">Role</div>
                  <p className="mt-0.5 text-[var(--app-text-secondary)]">{r.role_summary}</p>
                </div>
              ) : null}
              {typeof r.cv_match_summary === "string" ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">
                    CV match
                  </div>
                  <p className="mt-0.5 text-[var(--app-text-secondary)]">{r.cv_match_summary}</p>
                </div>
              ) : null}
              {typeof r.fit_rationale === "string" ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">
                    Fit rationale
                  </div>
                  <p className="mt-0.5 text-[var(--app-text-secondary)]">{r.fit_rationale}</p>
                </div>
              ) : null}
              {Array.isArray(r.gaps) && r.gaps.length ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">Gaps</div>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                    {r.gaps.filter((x: unknown): x is string => typeof x === "string").map((x, i) => (
                      <li key={`gap-${i}`}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Array.isArray(r.strengths) && r.strengths.length ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">
                    Strengths
                  </div>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                    {r.strengths.filter((x: unknown): x is string => typeof x === "string").map((x, i) => (
                      <li key={`str-${i}`}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Array.isArray(r.interview_talking_points) && r.interview_talking_points.length ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">
                    Interview talking points
                  </div>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                    {r.interview_talking_points
                      .filter((x: unknown): x is string => typeof x === "string")
                      .map((x, i) => (
                        <li key={`tp-${i}`}>{x}</li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : !reportQ.isLoading ? (
            <p className="text-[12px] text-[var(--app-text-tertiary)]">
              No report yet. Generate one from your résumé and the job description on file.
            </p>
          ) : null}
          {reportQ.data?.updated_at ? (
            <p className="text-[10px] text-[var(--app-text-tertiary)]">
              Updated{" "}
              <time dateTime={reportQ.data.updated_at}>
                {new Date(reportQ.data.updated_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <AppButton
              disabled={genM.isPending}
              size="sm"
              variant="primary"
              type="button"
              onClick={() => void genM.mutate()}
            >
              {genM.isPending ? "Generating…" : r ? "Refresh report" : "Generate report"}
            </AppButton>
            {canFollowup ? (
              <AppButton
                disabled={followupM.isPending}
                size="sm"
                variant="outline"
                type="button"
                onClick={() => void followupM.mutate()}
              >
                {followupM.isPending ? "Adding…" : "Add follow-up to approvals"}
              </AppButton>
            ) : null}
          </div>
          {genM.isError ? (
            <p className="text-[11px] text-[var(--app-badge-red-fg)]" role="alert">
              {genM.error instanceof Error ? genM.error.message : "Generation failed."}
            </p>
          ) : null}
          {followupM.isError ? (
            <p className="text-[11px] text-[var(--app-badge-red-fg)]" role="alert">
              {followupM.error instanceof Error ? followupM.error.message : "Could not create follow-up."}
            </p>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

function buildApplyPacketMarkdown(app: ApplicationRow): string {
  const lines = [
    `## Apply prep · ${app.company}`,
    "",
    `- **Role:** ${app.job_title}`,
    `- **Listing:** ${app.source_url ?? "—"}`,
    ...(app.job_id?.trim()
      ? [`- **Discovery:** /app/discovery/${app.job_id.trim()}`]
      : []),
    `- **Pipeline status:** ${app.status}`,
    "",
    "Paste this packet next to the employer’s form. Doubow never auto-submits on your behalf—you stay in control on their site.",
  ];
  if (app.notes?.trim()) {
    lines.push("", "**Your notes**", "", app.notes.trim());
  }
  return lines.join("\n");
}

function TrackerApplicationCard({
  app,
  isHighlight,
  generateDraftPending,
  onGenerateDraft,
}: {
  app: ApplicationRow;
  isHighlight: boolean;
  generateDraftPending: boolean;
  onGenerateDraft: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { variant, label } = applicationStatusBadge(app.status);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [followLocal, setFollowLocal] = useState(() => toDatetimeLocalValue(app.next_followup_at));
  const [tagsIn, setTagsIn] = useState(() => (app.tags ?? []).join(", "));

  useEffect(() => {
    setNotes(app.notes ?? "");
    setFollowLocal(toDatetimeLocalValue(app.next_followup_at));
    setTagsIn((app.tags ?? []).join(", "));
  }, [app.id, app.updated_at, app.notes, app.next_followup_at, app.tags]);

  const saveCrmM = useMutation({
    mutationFn: () =>
      patchApplication(app.id, {
        notes: notes.trim() ? notes.trim() : null,
        next_followup_at: followLocal.trim() ? fromDatetimeLocalValue(followLocal) : null,
        tags: parseTagsInput(tagsIn),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.applications }),
        qc.invalidateQueries({ queryKey: queryKeys.applicationDetail(app.id) }),
      ]);
    },
  });

  const copyPacketM = useMutation({
    mutationFn: async () => {
      await navigator.clipboard.writeText(buildApplyPacketMarkdown(app));
    },
  });

  const fu = followupLabel(app.next_followup_at);

  return (
    <article
      id={`tracker-app-${app.id}`}
      className={`rounded-[var(--app-radius-md)] border-[0.5px] bg-[var(--app-bg-elevated)] p-3 ${
        isHighlight
          ? "border-[var(--app-accent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--app-accent)_35%,transparent)]"
          : "border-[var(--app-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--app-text-primary)]">{app.job_title}</h3>
          <p className="mt-1 truncate text-[12px] text-[var(--app-text-secondary)]">{app.company}</p>
        </div>
        <AppBadge variant={variant}>{label}</AppBadge>
      </div>
      {app.tags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {app.tags.map((t) => (
            <span
              key={t}
              className="rounded-[var(--app-radius-pill)] bg-[var(--app-bg-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-text-secondary)] shadow-[inset_0_0_0_0.5px_var(--app-border)]"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {fu ? (
        <p
          className={`mt-2 text-[11px] tabular-nums ${fu.overdue ? "font-semibold text-[var(--app-badge-red-fg)]" : "text-[var(--app-text-tertiary)]"}`}
        >
          Follow-up {fu.overdue ? "due " : ""}
          <time dateTime={app.next_followup_at ?? undefined}>{fu.text}</time>
        </p>
      ) : null}
      {app.source_url ? (
        <a
          href={app.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block truncate text-[11px] font-medium text-[var(--app-accent)] hover:underline"
        >
          {(() => {
            try {
              return new URL(app.source_url!).hostname;
            } catch {
              return "Original posting";
            }
          })()}
        </a>
      ) : null}
      {app.status === "SUBMITTED" && app.submitted_at ? (
        <p className="mt-2 text-[11px] tabular-nums text-[var(--app-text-tertiary)]">
          Outreach sent{" "}
          <time dateTime={app.submitted_at}>
            {new Date(app.submitted_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {app.status === "DISCOVERED" || app.status === "RETRY" ? (
          <AppButton
            disabled={generateDraftPending}
            size="sm"
            variant="primary"
            type="button"
            onClick={() => onGenerateDraft(app.id)}
          >
            Generate outreach
          </AppButton>
        ) : null}
        {app.status === "PENDING_APPROVAL" || app.status === "APPROVED" ? (
          <Link
            className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-3 text-[12px] font-medium text-[var(--app-text-primary)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
            href="/app/approvals"
          >
            Review draft
          </Link>
        ) : null}
        <Link
          className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-3 text-[12px] font-medium text-[var(--app-text-primary)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
          href={`/app/ats-optimizer?applicationId=${encodeURIComponent(app.id)}`}
        >
          ATS check
        </Link>
        <AppButton
          disabled={copyPacketM.isPending}
          size="sm"
          variant="outline"
          type="button"
          onClick={() => void copyPacketM.mutate()}
        >
          Copy apply prep
        </AppButton>
      </div>
      {copyPacketM.isError ? (
        <p className="mt-2 text-[11px] text-[var(--app-badge-red-fg)]" role="alert">
          Clipboard unavailable in this browser context.
        </p>
      ) : null}

      <TrackerRoleInsightBlock appId={app.id} appStatus={app.status} />

      <div className="mt-4 space-y-2 border-t border-[var(--app-border)] pt-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Tracker</p>
        <label className="block text-[11px] text-[var(--app-text-secondary)]">
          Follow-up reminder
          <input
            type="datetime-local"
            value={followLocal}
            onChange={(e) => setFollowLocal(e.target.value)}
            className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-page)] px-2 py-1.5 text-[12px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
          />
        </label>
        <label className="block text-[11px] text-[var(--app-text-secondary)]">
          Tags (comma-separated)
          <input
            value={tagsIn}
            onChange={(e) => setTagsIn(e.target.value)}
            placeholder="e.g. stretch, warm intro"
            className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-page)] px-2 py-1.5 text-[12px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
          />
        </label>
        <label className="block text-[11px] text-[var(--app-text-secondary)]">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-y rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-page)] px-2 py-1.5 text-[12px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <AppButton
            disabled={saveCrmM.isPending}
            size="sm"
            variant="outline"
            type="button"
            onClick={() => void saveCrmM.mutate()}
          >
            Save tracker
          </AppButton>
        </div>
        {saveCrmM.isError ? (
          <p className="text-[11px] text-[var(--app-badge-red-fg)]" role="alert">
            {saveCrmM.error instanceof Error ? saveCrmM.error.message : "Could not save."}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function TrackerClient() {
  const { applicationsRefetchIntervalMs } = useApplicationsPipelineRealtime();

  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const qc = useQueryClient();

  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
    refetchInterval: applicationsRefetchIntervalMs,
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

  const addJobM = useMutation({
    mutationFn: createApplication,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.applications });
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addCompany, setAddCompany] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");

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

  useEffect(() => {
    if (!highlightId || loading) return;
    if (!sorted.some((a) => a.id === highlightId)) return;
    const el = document.getElementById(`tracker-app-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, loading, sorted]);
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
              Pipeline stages, CRM notes, follow-up reminders, and quick links to ATS checks—still human-in-the-loop for
              every send.
            </p>
          </div>
          <div className="grid w-full max-w-xl grid-cols-3 gap-2 lg:w-[420px]">
            {[
              ["Total", total],
              ["Review", pending],
              ["Sent", submitted],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[var(--app-radius-md)] bg-[var(--app-bg-muted)] px-3 py-2 shadow-[inset_0_0_0_0.5px_var(--app-border)]"
              >
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  {label}
                </div>
                <div className="mt-1 tabular-nums text-[18px] font-semibold leading-none text-[var(--app-text-primary)]">
                  {value}
                </div>
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
          <AppButton size="md" variant="outline" type="button" onClick={() => setAddOpen((o) => !o)}>
            {addOpen ? "Close add form" : "Add job manually"}
          </AppButton>
          <Link
            href="/app/approvals"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-4 text-[13px] font-medium leading-5 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-accent-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]"
          >
            Approval dashboard
          </Link>
        </div>

        {addOpen ? (
          <form
            className="mt-5 space-y-3 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const company = addCompany.trim();
              const job_title = addTitle.trim();
              if (!company || !job_title) return;
              const source_url = addUrl.trim() || null;
              addJobM.mutate(
                { company, job_title, source_url },
                {
                  onSuccess: () => {
                    setAddCompany("");
                    setAddTitle("");
                    setAddUrl("");
                    setAddOpen(false);
                  },
                },
              );
            }}
          >
            <p className="text-[13px] font-medium text-[var(--app-text-primary)]">Save a posting from anywhere</p>
            <p className="text-[12px] text-[var(--app-text-secondary)]">
              Creates a <strong className="font-medium">Saved</strong> application (same as discovery). Paste the job
              URL when you have it so ATS check can pull the description from the catalog.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] text-[var(--app-text-secondary)]">
                Company
                <input
                  required
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-2 py-2 text-[13px] text-[var(--app-text-primary)]"
                />
              </label>
              <label className="block text-[12px] text-[var(--app-text-secondary)]">
                Job title
                <input
                  required
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-2 py-2 text-[13px] text-[var(--app-text-primary)]"
                />
              </label>
            </div>
            <label className="block text-[12px] text-[var(--app-text-secondary)]">
              Job URL (optional)
              <input
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-2 py-2 text-[13px] text-[var(--app-text-primary)]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <AppButton disabled={addJobM.isPending} size="md" variant="primary" type="submit">
                Save to pipeline
              </AppButton>
            </div>
            {addJobM.isError ? (
              <p className="text-[12px] text-[var(--app-badge-red-fg)]" role="alert">
                {addJobM.error instanceof Error ? addJobM.error.message : "Could not add."}
              </p>
            ) : null}
          </form>
        ) : null}
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
            Start from a role in Find jobs, use <strong className="font-medium">Add job manually</strong> above, generate
            outreach, and the application will move through this board.
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 text-[13px] font-medium text-white hover:bg-[var(--app-accent-hover)]"
            href="/app/discovery"
          >
            Find jobs
          </Link>
        </div>
      ) : null}

      {!loading && sorted.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-5">
          {PIPELINE_COLUMNS.map((column) => {
            const rows = byColumn.get(column.id) ?? [];
            return (
              <section
                key={column.id}
                className="min-h-[220px] rounded-[var(--app-radius-lg)] bg-[var(--app-bg-muted)] p-3 shadow-[inset_0_0_0_0.5px_var(--app-border)]"
              >
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
                  {rows.map((app) => (
                    <TrackerApplicationCard
                      key={app.id}
                      app={app}
                      isHighlight={highlightId === app.id}
                      generateDraftPending={generateDraftM.isPending}
                      onGenerateDraft={(id) => void generateDraftM.mutate(id)}
                    />
                  ))}
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
