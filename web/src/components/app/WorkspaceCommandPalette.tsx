"use client";

import { fetchDrafts, type DraftRow } from "@/lib/applications-fetch";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { appNavSections } from "@/config/app-nav-sections";
import { useApplicationsPipelineRealtime } from "@/components/providers/ApplicationsPipelineRealtimeProvider";
import { AppIcon } from "@/components/ui/app-icon";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchMatchEvents,
  fetchWorkspaceSearchApplications,
  fetchWorkspaceSearchJobs,
  fetchWorkspaceSearchMilestones,
} from "@/lib/workspace-search-fetch";

const STALE_MS = 60_000;

const GROUP_LABEL = {
  pages: "Pages",
  jobs: "Jobs",
  applications: "Applications",
  drafts: "Drafts",
  milestones: "Milestones",
} as const;

type GroupKey = keyof typeof GROUP_LABEL;

type PaletteRow = {
  key: string;
  group: GroupKey;
  title: string;
  subtitle: string;
  href: string;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function matchesQuery(q: string, ...parts: (string | null | undefined)[]) {
  if (!q) return true;
  const blob = norm(parts.filter(Boolean).join(" "));
  return blob.includes(q);
}

const flatNavPages = appNavSections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    sectionTitle: section.title,
  })),
);

function buildRows(args: {
  q: string;
  jobs: Awaited<ReturnType<typeof fetchWorkspaceSearchJobs>>;
  applications: Awaited<ReturnType<typeof fetchWorkspaceSearchApplications>>;
  drafts: DraftRow[];
  milestones: Awaited<ReturnType<typeof fetchWorkspaceSearchMilestones>>;
}): PaletteRow[] {
  const ql = norm(args.q);
  const rows: PaletteRow[] = [];

  for (const p of flatNavPages) {
    if (
      !matchesQuery(
        ql,
        p.label,
        p.subtitle,
        p.href.replace(/^\/app\//, ""),
      )
    ) {
      continue;
    }
    rows.push({
      key: `page:${p.href}`,
      group: "pages",
      title: p.label,
      subtitle: p.subtitle ? `${p.sectionTitle} · ${p.subtitle}` : p.sectionTitle,
      href: p.href,
    });
  }

  const jobPool = args.jobs.filter((j) =>
    matchesQuery(ql, j.title, j.company, j.location),
  );
  const jobSlice = ql ? jobPool.slice(0, 24) : jobPool.slice(0, 12);
  for (const j of jobSlice) {
    rows.push({
      key: `job:${j.id}`,
      group: "jobs",
      title: j.title,
      subtitle: [j.company, j.location].filter(Boolean).join(" · "),
      href: `/app/discovery/${j.id}`,
    });
  }

  const appPool = args.applications.filter((a) =>
    matchesQuery(ql, a.job_title, a.company, a.status),
  );
  const appSlice = ql ? appPool.slice(0, 24) : appPool.slice(0, 10);
  for (const a of appSlice) {
    rows.push({
      key: `app:${a.id}`,
      group: "applications",
      title: a.job_title,
      subtitle: `${a.company} · ${a.status.replaceAll("_", " ")}`,
      href: `/app/tracker?highlight=${encodeURIComponent(a.id)}`,
    });
  }

  const appById = new Map(args.applications.map((a) => [a.id, a]));
  const draftPool = args.drafts.filter((d) => {
    const app = appById.get(d.application_id);
    return matchesQuery(
      ql,
      d.channel,
      d.content.slice(0, 200),
      app?.company,
      app?.job_title,
    );
  });
  const draftSlice = ql ? draftPool.slice(0, 16) : draftPool.slice(0, 8);
  for (const d of draftSlice) {
    const app = appById.get(d.application_id);
    rows.push({
      key: `draft:${d.id}`,
      group: "drafts",
      title: app ? `${app.company} — ${d.channel} draft` : `Draft (${d.channel})`,
      subtitle: "Open approvals queue",
      href: "/app/approvals",
    });
  }

  const milePool = args.milestones.filter((m) =>
    matchesQuery(ql, m.title, m.status),
  );
  const mileSlice = ql ? milePool.slice(0, 20) : milePool.slice(0, 10);
  for (const m of mileSlice) {
    rows.push({
      key: `ms:${m.id}`,
      group: "milestones",
      title: m.title,
      subtitle: m.status.replaceAll("_", " "),
      href: "/app/career-steps",
    });
  }

  return rows;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WorkspaceCommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { applicationsRefetchIntervalMs } = useApplicationsPipelineRealtime();
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardRef = useRef({ rows: [] as PaletteRow[], activeIndex: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const jobsQ = useQuery({
    queryKey: queryKeys.workspaceSearchJobs,
    queryFn: fetchWorkspaceSearchJobs,
    staleTime: STALE_MS,
    enabled: open,
  });
  const appsQ = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchWorkspaceSearchApplications,
    staleTime: STALE_MS,
    refetchInterval: open ? applicationsRefetchIntervalMs : false,
    enabled: open,
  });
  const draftsQ = useQuery({
    queryKey: queryKeys.applicationDrafts,
    queryFn: fetchDrafts,
    staleTime: STALE_MS,
    refetchInterval: open ? applicationsRefetchIntervalMs : false,
    enabled: open,
  });
  const mileQ = useQuery({
    queryKey: queryKeys.milestones,
    queryFn: fetchWorkspaceSearchMilestones,
    staleTime: STALE_MS,
    enabled: open,
  });

  const rows = useMemo(
    () =>
      buildRows({
        q,
        jobs: jobsQ.data ?? [],
        applications: appsQ.data ?? [],
        drafts: draftsQ.data ?? [],
        milestones: mileQ.data ?? [],
      }),
    [q, jobsQ.data, appsQ.data, draftsQ.data, mileQ.data],
  );

  keyboardRef.current = { rows, activeIndex };

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  useEffect(() => {
    if (rows.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((i) => Math.min(i, rows.length - 1));
  }, [rows.length]);

  useLayoutEffect(() => {
    if (open) {
      setQ("");
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    const { rows: list, activeIndex: idx } = keyboardRef.current;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.length === 0) return;
      setActiveIndex((i) => (i + 1) % list.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (list.length === 0) return;
      setActiveIndex((i) => (i - 1 + list.length) % list.length);
      return;
    }
    if (e.key === "Enter" && list.length > 0) {
      e.preventDefault();
      const row = list[idx];
      if (row) go(row.href);
    }
  }

  if (!mounted || !open) return null;

  const loading =
    jobsQ.isLoading || appsQ.isLoading || draftsQ.isLoading || mileQ.isLoading;
  const err =
    jobsQ.isError || appsQ.isError || draftsQ.isError || mileQ.isError
      ? "Some results could not be loaded. Try again."
      : null;

  let lastGroup: GroupKey | null = null;

  const panel = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 p-4 pt-[min(12vh,120px)] backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Workspace search"
        className="flex max-h-[min(72vh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] shadow-[var(--app-shadow-1)]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[var(--app-border)] px-4 py-3">
          <AppIcon name="search" className="size-5 shrink-0 text-[var(--app-text-tertiary)]" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, jobs, applications, drafts, milestones…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)]"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="workspace-command-results"
          />
          <kbd className="hidden shrink-0 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-2 py-1 font-mono text-[11px] text-[var(--app-text-secondary)] sm:inline">
            esc
          </kbd>
        </div>

        {err ? (
          <p className="border-b border-[var(--app-border)] px-4 py-2 text-[13px] text-[var(--app-badge-red-fg)]" role="alert">
            {err}
          </p>
        ) : null}

        <div
          id="workspace-command-results"
          className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
          role="listbox"
          aria-activedescendant={rows[activeIndex] ? `palette-row-${activeIndex}` : undefined}
        >
          {loading ? (
            <p className="px-2 py-6 text-center text-[13px] text-[var(--app-text-secondary)]" aria-busy="true">
              Loading workspace data…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--app-text-secondary)]">No matches.</p>
          ) : (
            rows.map((row, globalIndex) => {
              const showHead = row.group !== lastGroup;
              lastGroup = row.group;
              const active = globalIndex === activeIndex;
              return (
                <Fragment key={row.key}>
                  {showHead ? (
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
                      {GROUP_LABEL[row.group]}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    id={`palette-row-${globalIndex}`}
                    role="option"
                    aria-selected={active}
                    className={`mb-0.5 flex w-full flex-col gap-0.5 rounded-[var(--app-radius-md)] px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--app-accent)_35%,transparent)]"
                        : "hover:bg-[var(--app-bg-muted)]"
                    }`}
                    onMouseEnter={() => setActiveIndex(globalIndex)}
                    onClick={() => go(row.href)}
                  >
                    <span className="text-[14px] font-medium text-[var(--app-text-primary)]">{row.title}</span>
                    <span className="text-[12px] text-[var(--app-text-secondary)]">{row.subtitle}</span>
                  </button>
                </Fragment>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--app-border)] px-4 py-2 text-[11px] text-[var(--app-text-tertiary)]">
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <kbd className="rounded bg-[var(--app-bg-muted)] px-1 font-mono">↑</kbd>{" "}
              <kbd className="rounded bg-[var(--app-bg-muted)] px-1 font-mono">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded bg-[var(--app-bg-muted)] px-1 font-mono">↵</kbd> open
            </span>
            <button
              type="button"
              className="ml-auto font-medium text-[var(--app-accent)] hover:underline"
              onClick={() => {
                onOpenChange(false);
                router.push("/app/search");
              }}
            >
              Full search page →
            </button>
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/** Top bar: signal when there are drafts to approve or discovery match events. */
export function useWorkspaceNotificationDot() {
  const draftsQ = useQuery({
    queryKey: queryKeys.applicationDrafts,
    queryFn: fetchDrafts,
    staleTime: STALE_MS,
  });
  const eventsQ = useQuery({
    queryKey: queryKeys.matchEvents,
    queryFn: fetchMatchEvents,
    staleTime: STALE_MS,
  });
  const n = (draftsQ.data?.length ?? 0) + (eventsQ.data?.length ?? 0);
  return n > 0;
}
