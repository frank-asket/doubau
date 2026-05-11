"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { JobPipelineHint } from "@/components/app/JobPipelineHint";
import { useApplicationsPipelineWs } from "@/hooks/useApplicationsPipelineWs";
import { AppApprovalCard } from "@/components/ui/approval-card";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PIPELINE_LEGEND,
  applicationStatusBadge,
} from "@/lib/application-status";
import { fetchApplications, fetchDrafts, type ApplicationRow, type DraftRow } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";

/** Safety-net polling when WS is unavailable; pipeline WS drives most updates. */
const APPROVALS_POLL_MS = 60_000;

type Application = ApplicationRow;
type Draft = DraftRow;

const EMPTY_APP_MAP: Map<string, Application> = new Map();

function snippetPreview(text: string, max = 280): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function draftSubtitle(draft: Draft, app: Application | undefined): string {
  const channel = draft.channel ? draft.channel.charAt(0).toUpperCase() + draft.channel.slice(1) : "Draft";
  if (app?.source_url) {
    try {
      const host = new URL(app.source_url).hostname;
      return `${channel} · ${host}`;
    } catch {
      /* ignore */
    }
  }
  return app ? `${channel} · ${app.company}` : `${channel} · application`;
}

export default function ApprovalsPage() {
  useApplicationsPipelineWs(true);

  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
    refetchInterval: APPROVALS_POLL_MS,
  });

  const draftsQuery = useQuery({
    queryKey: queryKeys.applicationDrafts,
    queryFn: fetchDrafts,
    refetchInterval: APPROVALS_POLL_MS,
  });

  const invalidateApprovalQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.applications }),
      qc.invalidateQueries({ queryKey: queryKeys.applicationDrafts }),
    ]);
  };

  const patchDraftM = useMutation({
    mutationFn: async ({ draftId, content }: { draftId: string; content: string }) => {
      const resp = await fetch(`/api/applications/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { detail?: string };
        throw new Error(typeof data.detail === "string" ? data.detail : "Could not save draft.");
      }
    },
    onMutate: () => setMutationError(null),
    onSuccess: async () => {
      setEditingDraftId(null);
      await invalidateApprovalQueries();
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : "Could not save draft.");
    },
  });

  const approveM = useMutation({
    mutationFn: async (appId: string) => {
      const resp = await fetch(`/api/applications/${appId}/approve`, { method: "POST" });
      if (!resp.ok) throw new Error("approve");
    },
    onMutate: (appId) => {
      setBusyId(appId);
      setMutationError(null);
    },
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await invalidateApprovalQueries();
    },
    onError: () => setMutationError("Approve failed."),
  });

  const rejectM = useMutation({
    mutationFn: async (appId: string) => {
      const resp = await fetch(`/api/applications/${appId}/reject`, { method: "POST" });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { detail?: string };
        throw new Error(typeof data.detail === "string" ? data.detail : "Reject failed.");
      }
    },
    onMutate: (appId) => {
      setBusyId(appId);
      setMutationError(null);
    },
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await invalidateApprovalQueries();
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : "Reject failed.");
    },
  });

  const submitM = useMutation({
    mutationFn: async (appId: string) => {
      const resp = await fetch(`/api/applications/${appId}/submit`, { method: "POST" });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { detail?: string };
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Submit failed (must be APPROVED first).",
        );
      }
    },
    onMutate: (appId) => {
      setBusyId(appId);
      setMutationError(null);
    },
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await invalidateApprovalQueries();
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : "Submit failed.");
    },
  });

  const loadError =
    applicationsQuery.isError || draftsQuery.isError ? "Failed to load approvals data." : null;
  const error = mutationError ?? loadError;

  const loadingInitial = applicationsQuery.isLoading || draftsQuery.isLoading;

  const sortedDrafts = useMemo(() => {
    const draftsList = draftsQuery.data ?? [];
    const appsList = applicationsQuery.data ?? [];
    const appById = new Map(appsList.map((a) => [a.id, a]));
    const order = (s: string) => {
      if (s === "PENDING_APPROVAL") return 0;
      if (s === "APPROVED") return 1;
      if (s === "FAILED" || s === "RETRY") return 2;
      if (s === "SUBMITTED") return 3;
      return 4;
    };
    return [...draftsList].sort((a, b) => {
      const sa = appById.get(a.application_id)?.status ?? "";
      const sb = appById.get(b.application_id)?.status ?? "";
      return order(sa) - order(sb);
    });
  }, [draftsQuery.data, applicationsQuery.data]);

  const applicationsData = applicationsQuery.data;
  const appById = useMemo(() => {
    if (!applicationsData?.length) return EMPTY_APP_MAP;
    return new Map(applicationsData.map((a) => [a.id, a]));
  }, [applicationsData]);

  const draftCount = draftsQuery.data?.length ?? 0;
  const pendingCount = sortedDrafts.filter((d) => appById.get(d.application_id)?.status === "PENDING_APPROVAL").length;
  const approvedCount = sortedDrafts.filter((d) => appById.get(d.application_id)?.status === "APPROVED").length;

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <section className="app-surface rounded-[var(--app-radius-lg)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Review queue
            </div>
            <h1 className="mt-1 text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
              Approval dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
              Drafts land here after <span className="font-medium text-[var(--app-text-primary)]">Generate outreach</span> on a
              job. Edit the message, approve it, then submit when you are ready. Nothing goes out without your sign-off.
            </p>
            <p className="mt-3 text-[13px] text-[var(--app-text-secondary)]">
              Continue from{" "}
              <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                Job discovery
              </Link>{" "}
              anytime.
            </p>
          </div>
          <div className="w-full max-w-xl lg:w-[420px]">
            <JobPipelineHint variant="approvals" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Drafts", draftCount],
                ["Pending", pendingCount],
                ["Approved", approvedCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[var(--app-radius-md)] bg-[var(--app-bg-muted)] px-3 py-2 shadow-[inset_0_0_0_0.5px_var(--app-border)]">
                  <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">{label}</div>
                  <div className="mt-1 tabular-nums text-[18px] font-semibold leading-none text-[var(--app-text-primary)]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/app/discovery"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-4 text-[13px] font-medium leading-5 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-accent-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]"
          >
            Find roles to contact
          </Link>
        </div>
      </section>

      <div className="app-surface rounded-[var(--app-radius-lg)] px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Pipeline states
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PIPELINE_LEGEND.map((item) => (
            <AppBadge key={item.label} variant={item.variant}>
              {item.label}
            </AppBadge>
          ))}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-4 py-3 text-pretty text-[13px] leading-relaxed text-[var(--app-danger)]"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-[var(--app-space-md)]">
        {loadingInitial && draftCount === 0 ? (
          <div
            className="app-surface rounded-[var(--app-radius-lg)] p-6"
            aria-busy="true"
            aria-label="Loading approvals"
          >
            <div className="space-y-3">
              <div className="h-4 w-[32%] max-w-[200px] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
              <div className="h-3 w-full max-w-md animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
              <div className="h-3 w-[88%] max-w-lg animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
              <div className="h-20 w-full animate-pulse rounded-[var(--app-radius-md)] bg-[var(--app-bg-muted)]" />
            </div>
            <p className="mt-4 text-[12px] text-[var(--app-text-tertiary)]">Loading drafts and applications…</p>
          </div>
        ) : null}

        {!loadingInitial && sortedDrafts.length === 0 ? (
          <div className="app-surface rounded-[var(--app-radius-lg)] border-dashed px-5 py-8 sm:px-8 sm:py-10">
            <p className="text-center text-[14px] font-semibold text-[var(--app-text-primary)]">Nothing in your queue yet</p>
            <p className="mx-auto mt-2 max-w-md text-center text-pretty text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
              When you generate outreach from a role, drafts land here for review before anything is sent.
            </p>
            <ol className="mx-auto mt-6 max-w-md list-none space-y-3 text-left text-[13px] text-[var(--app-text-secondary)]">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] text-[12px] font-semibold text-[var(--app-text-primary)]">
                  1
                </span>
                <span className="pt-0.5">
                  Open{" "}
                  <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                    Discovery
                  </Link>{" "}
                  and choose a role.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] text-[12px] font-semibold text-[var(--app-text-primary)]">
                  2
                </span>
                <span className="pt-0.5">
                  Use <span className="font-medium text-[var(--app-text-primary)]">Generate outreach</span> on the job
                  page.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] text-[12px] font-semibold text-[var(--app-text-primary)]">
                  3
                </span>
                <span className="pt-0.5">
                  Return here to edit, approve, and submit only when the message feels right.
                </span>
              </li>
            </ol>
          </div>
        ) : null}

        {sortedDrafts.map((d) => {
          const app = appById.get(d.application_id);
          const status = app?.status ?? "UNKNOWN";
          const { variant, label } = applicationStatusBadge(status);
          const title = app ? `${app.job_title} — ${app.company}` : d.application_id;
          const subtitle = draftSubtitle(d, app);
          const busy = busyId === d.application_id;
          const isEditing = editingDraftId === d.id;

          if (!app) {
            return (
              <AppApprovalCard
                key={d.id}
                actionsSlot={null}
                badgeLabel="UNKNOWN"
                badgeVariant="gray"
                snippet={snippetPreview(d.content)}
                subtitle={subtitle}
                title={title}
              />
            );
          }

          if (status === "APPROVED") {
            return (
              <AppApprovalCard
                key={d.id}
                actionsSlot={
                  <>
                    <AppButton
                      disabled={busy}
                      size="sm"
                      variant="primary"
                      type="button"
                      onClick={() => submitM.mutate(app.id)}
                    >
                      Submit outreach
                    </AppButton>
                    <span className="self-center text-[12px] text-[var(--app-text-secondary)]">
                      Draft approved — submit when you&apos;re ready.
                    </span>
                  </>
                }
                badgeLabel={label}
                badgeVariant={variant}
                snippet={snippetPreview(d.content)}
                subtitle={subtitle}
                title={title}
              />
            );
          }

          if (status === "SUBMITTED" || status === "FAILED" || status === "RETRY") {
            return (
              <AppApprovalCard
                key={d.id}
                actionsSlot={null}
                badgeLabel={label}
                badgeVariant={variant}
                snippet={snippetPreview(d.content)}
                subtitle={subtitle}
                title={title}
              />
            );
          }

          const snippetNode = isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={10}
                value={editBody}
                disabled={patchDraftM.isPending}
                onChange={(e) => setEditBody(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <AppButton
                  disabled={patchDraftM.isPending || !editBody.trim()}
                  size="sm"
                  variant="primary"
                  type="button"
                  onClick={() => patchDraftM.mutate({ draftId: d.id, content: editBody.trim() })}
                >
                  Save draft
                </AppButton>
                <AppButton
                  disabled={patchDraftM.isPending}
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setEditingDraftId(null)}
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          ) : (
            snippetPreview(d.content)
          );

          return (
            <AppApprovalCard
              key={d.id}
              actionsDisabled={busy || isEditing || patchDraftM.isPending}
              badgeLabel={label}
              badgeVariant={variant}
              snippet={snippetNode}
              subtitle={subtitle}
              title={title}
              onApprove={() => approveM.mutate(app.id)}
              onEdit={() => {
                setEditingDraftId(d.id);
                setEditBody(d.content);
              }}
              onReject={() => rejectM.mutate(app.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
