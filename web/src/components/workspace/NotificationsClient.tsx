"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApplicationsPipelineRealtime } from "@/components/providers/ApplicationsPipelineRealtimeProvider";
import { AppIcon } from "@/components/ui/app-icon";
import { fetchApplications, fetchDrafts } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";
import { fetchMatchEvents } from "@/lib/workspace-search-fetch";

import { ProductPageChrome } from "./ProductPageChrome";

type FeedItem = {
  id: string;
  at: number;
  title: string;
  detail: string;
  href: string;
  icon: "briefcase" | "message-circle" | "analytics";
};

function formatWhen(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationsClient() {
  const { applicationsRefetchIntervalMs } = useApplicationsPipelineRealtime();
  const appsQ = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
    refetchInterval: applicationsRefetchIntervalMs,
  });
  const draftsQ = useQuery({
    queryKey: queryKeys.applicationDrafts,
    queryFn: fetchDrafts,
    refetchInterval: applicationsRefetchIntervalMs,
  });
  const eventsQ = useQuery({ queryKey: queryKeys.matchEvents, queryFn: fetchMatchEvents });

  const items = useMemo(() => {
    const apps = appsQ.data ?? [];
    const drafts = draftsQ.data ?? [];
    const events = eventsQ.data ?? [];
    const appById = new Map(apps.map((a) => [a.id, a]));

    const out: FeedItem[] = [];

    for (const a of apps) {
      const t = a.updated_at || a.created_at;
      const ts = t ? Date.parse(t) : 0;
      out.push({
        id: `app-${a.id}`,
        at: ts,
        title: `${a.company} — ${a.job_title}`,
        detail: `Application · ${a.status.replaceAll("_", " ")}`,
        href: `/app/tracker?highlight=${encodeURIComponent(a.id)}`,
        icon: "briefcase",
      });
    }

    for (const d of drafts) {
      const app = appById.get(d.application_id);
      const t = app?.updated_at || app?.created_at;
      const ts = t ? Date.parse(t) : 0;
      out.push({
        id: `draft-${d.id}`,
        at: ts || Date.now(),
        title: app ? `${app.company} — outreach (${d.channel})` : `Draft · ${d.channel}`,
        detail: "Approval queue — review before send",
        href: "/app/approvals",
        icon: "message-circle",
      });
    }

    for (const ev of events) {
      const ts = ev.created_at ? Date.parse(String(ev.created_at)) : 0;
      const reason = ev.reason?.trim() || ev.event_type.replaceAll("_", " ");
      out.push({
        id: `match-${ev.id}`,
        at: ts,
        title: reason,
        detail: "Discovery signal — open scored role",
        href: `/app/discovery/${encodeURIComponent(ev.job_id)}`,
        icon: "analytics",
      });
    }

    out.sort((a, b) => b.at - a.at);
    return out.slice(0, 80);
  }, [appsQ.data, draftsQ.data, eventsQ.data]);

  const loading = appsQ.isLoading || draftsQ.isLoading || eventsQ.isLoading;
  const err =
    appsQ.isError || draftsQ.isError || eventsQ.isError ? "Some activity could not be loaded." : null;

  return (
    <ProductPageChrome
      title="Notifications"
      description="Live activity from your applications, drafts awaiting approval, and discovery match events — powered by the same APIs as Tracker and Discovery (no separate notification inbox yet)."
    >
      {err ? (
        <p className="text-[13px] text-[var(--app-danger)]" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6" aria-busy="true">
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--app-bg-muted)]" />
            <div className="h-12 animate-pulse rounded-lg bg-[var(--app-bg-muted)]" />
            <div className="h-12 animate-pulse rounded-lg bg-[var(--app-bg-muted)]" />
          </div>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/30 px-5 py-8 text-center">
          <p className="text-[14px] font-medium text-[var(--app-text-primary)]">No activity yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            Start in{" "}
            <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
              Discovery
            </Link>{" "}
            or upload your résumé on the{" "}
            <Link href="/app/dashboard" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
              Dashboard
            </Link>
            .
          </p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                className="flex gap-4 rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 transition-colors hover:border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-accent)]">
                  <AppIcon name={it.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-[var(--app-text-primary)]">{it.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--app-text-secondary)]">{it.detail}</span>
                </span>
                <span className="shrink-0 self-center text-[11px] tabular-nums text-[var(--app-text-tertiary)]">
                  {formatWhen(it.at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </ProductPageChrome>
  );
}
