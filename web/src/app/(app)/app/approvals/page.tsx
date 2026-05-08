"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppApprovalCard } from "@/components/ui/approval-card";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import {
  PIPELINE_LEGEND,
  applicationStatusBadge,
} from "@/lib/application-status";

type Application = {
  id: string;
  company: string;
  job_title: string;
  status: string;
  source_url?: string | null;
};

type Draft = {
  id: string;
  application_id: string;
  channel: string;
  content: string;
};

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
  const [apps, setApps] = useState<Application[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appById = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [appsResp, draftsResp] = await Promise.all([
        fetch("/api/applications", { cache: "no-store" }),
        fetch("/api/applications/drafts", { cache: "no-store" }),
      ]);
      if (!appsResp.ok || !draftsResp.ok) {
        setError("Failed to load approvals data.");
        return;
      }
      setApps(await appsResp.json());
      setDrafts(await draftsResp.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createDemo = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const created = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: "Acme", job_title: "Product Manager" }),
      });
      if (!created.ok) {
        setError("Failed to create demo application.");
        return;
      }
      const app = (await created.json()) as Application;
      await fetch(`/api/applications/${app.id}/generate_draft`, { method: "POST" });
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const approve = useCallback(
    async (appId: string) => {
      setError(null);
      setBusyId(appId);
      try {
        const resp = await fetch(`/api/applications/${appId}/approve`, { method: "POST" });
        if (!resp.ok) {
          setError("Approve failed.");
          return;
        }
        await refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const reject = useCallback(
    async (appId: string) => {
      setError(null);
      setBusyId(appId);
      try {
        const resp = await fetch(`/api/applications/${appId}/reject`, { method: "POST" });
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { detail?: string };
          setError(typeof data.detail === "string" ? data.detail : "Reject failed.");
          return;
        }
        await refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const submit = useCallback(
    async (appId: string) => {
      setError(null);
      setBusyId(appId);
      try {
        const resp = await fetch(`/api/applications/${appId}/submit`, { method: "POST" });
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { detail?: string };
          setError(data.detail ?? "Submit failed (must be APPROVED first).");
          return;
        }
        await refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const sortedDrafts = useMemo(() => {
    const order = (s: string) => {
      if (s === "PENDING_APPROVAL") return 0;
      if (s === "APPROVED") return 1;
      if (s === "FAILED" || s === "RETRY") return 2;
      if (s === "SUBMITTED") return 3;
      return 4;
    };
    return [...drafts].sort((a, b) => {
      const sa = appById.get(a.application_id)?.status ?? "";
      const sb = appById.get(b.application_id)?.status ?? "";
      return order(sa) - order(sb);
    });
  }, [drafts, appById]);

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
            Approvals
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
            Review AI drafts before anything is sent. Approve to unlock submit; reject sends the application to a failed
            state until you retry from the tracker.
          </p>
        </div>

        <AppButton
          disabled={loading}
          size="md"
          variant="outline"
          type="button"
          onClick={() => void createDemo()}
        >
          Create demo draft
        </AppButton>
      </div>

      <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3">
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
        <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--app-danger)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-[var(--app-space-md)]">
        {loading && drafts.length === 0 ? (
          <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 text-[13px] text-[var(--app-text-secondary)]">
            Loading…
          </div>
        ) : null}

        {!loading && sortedDrafts.length === 0 ? (
          <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6">
            <p className="text-[13px] leading-6 text-[var(--app-text-secondary)]">
              No drafts awaiting review. Create a demo draft to run through approve → submit.
            </p>
          </div>
        ) : null}

        {sortedDrafts.map((d) => {
          const app = appById.get(d.application_id);
          const status = app?.status ?? "UNKNOWN";
          const { variant, label } = applicationStatusBadge(status);
          const title = app ? `${app.job_title} — ${app.company}` : d.application_id;
          const subtitle = draftSubtitle(d, app);
          const busy = busyId === d.application_id;

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
                      onClick={() => void submit(app.id)}
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

          /* PENDING_APPROVAL and other editable states */
          return (
            <AppApprovalCard
              key={d.id}
              actionsDisabled={busy}
              badgeLabel={label}
              badgeVariant={variant}
              snippet={snippetPreview(d.content)}
              subtitle={subtitle}
              title={title}
              onApprove={() => void approve(app.id)}
              onEdit={() => {
                window.alert("Composer editing will open here — draft text is read-only for now.");
              }}
              onReject={() => void reject(app.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
