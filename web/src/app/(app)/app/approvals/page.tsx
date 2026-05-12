"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

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
import { fetchApplications, fetchDrafts, gmailSentMessageWebUrl, type ApplicationRow, type DraftRow } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";
import { suggestRecipientEmailFromJobUrl } from "@/lib/suggest-recipient-email";

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
  const [recipientByAppId, setRecipientByAppId] = useState<Record<string, string>>({});
  const [gmailSendNotice, setGmailSendNotice] = useState<{
    recipient: string;
    messageId: string | null;
    updatedAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!gmailSendNotice) return;
    const t = window.setTimeout(() => setGmailSendNotice(null), 14_000);
    return () => window.clearTimeout(t);
  }, [gmailSendNotice]);

  const googleMailboxQ = useQuery({
    queryKey: queryKeys.googleMailbox,
    queryFn: async () => {
      const r = await fetch("/api/me/google/status", { cache: "no-store" });
      if (!r.ok) throw new Error("google");
      return (await r.json()) as {
        oauth_configured: boolean;
        connected: boolean;
        google_account_email?: string | null;
      };
    },
  });

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

  const sendGmailM = useMutation({
    mutationFn: async ({ appId, recipientEmail }: { appId: string; recipientEmail: string }) => {
      const resp = await fetch(`/api/applications/${encodeURIComponent(appId)}/send-gmail-in-app`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient_email: recipientEmail.trim() }),
      });
      const data = (await resp.json().catch(() => ({}))) as ApplicationRow & { detail?: string };
      if (!resp.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Gmail send failed.");
      }
      return data as ApplicationRow;
    },
    onMutate: () => setMutationError(null),
    onSuccess: async (app) => {
      setGmailSendNotice({
        recipient: app.recipient_email?.trim() ?? "",
        messageId: app.gmail_sent_message_id?.trim() || null,
        updatedAt: app.updated_at ?? null,
      });
      await invalidateApprovalQueries();
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : "Gmail send failed.");
    },
  });

  const skipLinkedInM = useMutation({
    mutationFn: async (appId: string) => {
      const resp = await fetch(`/api/applications/${encodeURIComponent(appId)}/skip-linkedin-draft`, {
        method: "POST",
      });
      const data = (await resp.json().catch(() => ({}))) as { detail?: string };
      if (!resp.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Could not update LinkedIn draft.");
      }
    },
    onMutate: () => setMutationError(null),
    onSuccess: async () => {
      await invalidateApprovalQueries();
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : "Could not update LinkedIn draft.");
    },
  });

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

      {gmailSendNotice ? (
        <div
          role="status"
          className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-success)_38%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-success)_10%,var(--app-bg-elevated))] px-4 py-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-[var(--app-text-primary)]">Message sent from your Gmail</p>
              {gmailSendNotice.recipient ? (
                <p>
                  <span className="text-[var(--app-text-tertiary)]">To</span>{" "}
                  <span className="font-medium text-[var(--app-text-primary)]">{gmailSendNotice.recipient}</span>
                  {gmailSendNotice.updatedAt ? (
                    <>
                      {" "}
                      <span className="text-[var(--app-text-tertiary)]">·</span>{" "}
                      <time className="tabular-nums text-[var(--app-text-tertiary)]" dateTime={gmailSendNotice.updatedAt}>
                        {new Date(gmailSendNotice.updatedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </>
                  ) : null}
                </p>
              ) : null}
              <p className="text-[12px] text-[var(--app-text-tertiary)]">
                A BCC copy should appear in your inbox (unless you sent to your own address). Sent mail also lists the employer
                line.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              {gmailSendNotice.messageId ? (
                <a
                  href={gmailSentMessageWebUrl(gmailSendNotice.messageId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius-pill)] border border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-white px-3 text-[12px] font-medium text-[var(--app-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_08%,white)]"
                >
                  Open in Gmail
                </a>
              ) : null}
              <button
                type="button"
                className="text-[12px] font-medium text-[var(--app-text-tertiary)] underline-offset-4 hover:text-[var(--app-text-secondary)] hover:underline"
                onClick={() => setGmailSendNotice(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
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
            const gmailReady = Boolean(
              googleMailboxQ.data?.oauth_configured && googleMailboxQ.data?.connected,
            );
            const defaultRec = suggestRecipientEmailFromJobUrl(app.source_url ?? "");
            const recipient = recipientByAppId[app.id] ?? (app.recipient_email?.trim() || defaultRec);

            if (d.channel === "linkedin") {
              return (
                <AppApprovalCard
                  key={d.id}
                  actionsSlot={
                    <div className="flex max-w-lg flex-col gap-2">
                      <p className="text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
                        LinkedIn messages cannot be sent from Doubow without LinkedIn partner API access. If you are
                        applying by email, close this draft here so your pipeline stays accurate.
                      </p>
                      <AppButton
                        disabled={skipLinkedInM.isPending}
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => skipLinkedInM.mutate(app.id)}
                      >
                        Close LinkedIn draft (in-app)
                      </AppButton>
                    </div>
                  }
                  badgeLabel={label}
                  badgeVariant={variant}
                  snippet={snippetPreview(d.content)}
                  subtitle={subtitle}
                  title={title}
                />
              );
            }

            return (
              <AppApprovalCard
                key={d.id}
                actionsSlot={
                  <div className="flex w-full min-w-0 max-w-lg flex-col gap-2">
                    {gmailReady ? (
                      <>
                        <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
                          Recruiter or careers email
                          <input
                            type="email"
                            value={recipient}
                            onChange={(e) =>
                              setRecipientByAppId((m) => ({ ...m, [app.id]: e.target.value }))
                            }
                            placeholder="careers@company.com"
                            className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <AppButton
                            disabled={busy || sendGmailM.isPending || !recipient.trim()}
                            size="sm"
                            variant="primary"
                            type="button"
                            onClick={() => sendGmailM.mutate({ appId: app.id, recipientEmail: recipient })}
                          >
                            {sendGmailM.isPending ? "Sending…" : "Send from my Gmail"}
                          </AppButton>
                          <AppButton
                            disabled={busy || submitM.isPending}
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => submitM.mutate(app.id)}
                          >
                            Queue server send
                          </AppButton>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
                          Sends through your connected Gmail. You are BCC&apos;d on the same message (unless the recipient is your
                          own address) so a copy lands in your inbox. Doubow stores the Gmail message id and recipient after a
                          successful send. &quot;Queue server send&quot; uses the legacy SMTP relay when configured on the API.
                        </p>
                      </>
                    ) : (
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
                        <p className="text-[12px] text-[var(--app-text-secondary)]">
                          <Link href="/app/settings" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                            Connect Gmail
                          </Link>{" "}
                          to send from your mailbox without opening Gmail.
                        </p>
                      </>
                    )}
                  </div>
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
            const submittedProof =
              status === "SUBMITTED" && (app.recipient_email?.trim() || app.gmail_sent_message_id?.trim()) ? (
                <div className="max-w-lg space-y-2 rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--app-success)_30%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-success)_06%,var(--app-bg-page))] px-3 py-3 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
                  <p className="font-semibold text-[var(--app-text-primary)]">Send record</p>
                  {app.recipient_email?.trim() ? (
                    <p>
                      <span className="text-[var(--app-text-tertiary)]">To</span>{" "}
                      <span className="font-medium text-[var(--app-text-primary)]">{app.recipient_email.trim()}</span>
                    </p>
                  ) : null}
                  {app.updated_at ? (
                    <p className="tabular-nums text-[var(--app-text-tertiary)]">
                      Recorded{" "}
                      <time dateTime={app.updated_at}>
                        {new Date(app.updated_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </p>
                  ) : null}
                  {app.gmail_sent_message_id?.trim() ? (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[var(--app-text-tertiary)]">Gmail id</span>
                      <code className="rounded bg-[var(--app-bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--app-text-primary)]">
                        {app.gmail_sent_message_id.trim().length > 28
                          ? `${app.gmail_sent_message_id.trim().slice(0, 14)}…${app.gmail_sent_message_id.trim().slice(-10)}`
                          : app.gmail_sent_message_id.trim()}
                      </code>
                      <a
                        href={gmailSentMessageWebUrl(app.gmail_sent_message_id.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline"
                      >
                        Open in Gmail
                      </a>
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--app-text-tertiary)]">
                      No Gmail message id on file — this submission may have used server queue / SMTP instead of in-app Gmail.
                    </p>
                  )}
                </div>
              ) : null;

            return (
              <AppApprovalCard
                key={d.id}
                actionsSlot={submittedProof}
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
