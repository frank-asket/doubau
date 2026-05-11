"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { JobPipelineHint } from "@/components/app/JobPipelineHint";
import { DiscoveryCoverageNotice } from "@/components/discovery/DiscoveryCoverageNotice";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type JobRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  seniority: string | null;
  employment_type: string | null;
  description: string | null;
  tags: string[];
  source_url: string | null;
  listing_source?: string | null;
  source_posted_at?: string | null;
  created_at: string;
};

export type FeedRow = {
  job: JobRow;
  score: number;
  similarity: number | null;
};

type FitScoreResponse = {
  score: number;
  match_pct: number;
  rationale: string;
  gap_skills: string[];
  strength_skills: string[];
};

type TabKey = "feed" | "all" | "hidden";

function listingSourceLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const labels: Record<string, string> = {
    remoteok: "Remote OK",
    adzuna: "Adzuna",
    http_fetch: "Imported page",
    manual: "Manual entry",
  };
  return labels[code] ?? code;
}

function formatListedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ScoreBadge({ value, label }: { value: number; label: string }) {
  const rounded = Math.round(value);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
        {label}
      </span>
      <span className="tabular-nums text-[22px] font-semibold leading-none tracking-tight text-[var(--app-text-primary)]">
        {rounded}
      </span>
    </div>
  );
}

function JobCard({
  row,
  tab,
  fitData,
  fitLoadingId,
  expandedFitId,
  onFit,
  onToggleFit,
  hideBusyId,
  onHide,
  hideLabel,
  feedbackBusyId,
  downvoteOpenId,
  downvoteReason,
  onToggleDownvote,
  onChangeDownvoteReason,
  onUpvote,
  onDownvote,
  onImpression,
  onClickOut,
}: {
  row: FeedRow;
  tab: TabKey;
  fitData: Record<string, FitScoreResponse>;
  fitLoadingId: string | null;
  expandedFitId: string | null;
  onFit: (jobId: string) => void;
  onToggleFit: (jobId: string) => void;
  hideBusyId: string | null;
  onHide: (jobId: string) => void;
  hideLabel?: string;
  feedbackBusyId: string | null;
  downvoteOpenId: string | null;
  downvoteReason: string;
  onToggleDownvote: (jobId: string) => void;
  onChangeDownvoteReason: (v: string) => void;
  onUpvote: (jobId: string) => void;
  onDownvote: (jobId: string, reason: string) => void;
  onImpression: (jobId: string, meta: Record<string, unknown>) => void;
  onClickOut: (jobId: string, meta: Record<string, unknown>) => void;
}) {
  const job = row.job;
  const score = row.score;
  const similarity = row.similarity;
  const showMatchRing = tab === "feed";

  const fit = fitData[job.id];
  const open = expandedFitId === job.id;

  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first) return;
        if (first.isIntersecting) {
          onImpression(job.id, {
            tab,
            similarity,
            score,
            listing_source: job.listing_source ?? null,
          });
          obs.disconnect();
        }
      },
      { root: null, threshold: 0.4 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [job.id, job.listing_source, onImpression, score, similarity, tab]);

  return (
    <div
      ref={rootRef}
      className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 transition-colors hover:border-[var(--app-border-strong,#ffffff14)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-pretty text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
              <Link
                href={`/app/discovery/${job.id}`}
                className="hover:text-[var(--app-accent)] hover:underline"
              >
                {job.title}
              </Link>
            </h2>
            {job.tags?.slice(0, 3).map((t) => (
              <AppBadge key={t} variant="gray">
                {t}
              </AppBadge>
            ))}
          </div>
          <p className="text-[13px] text-[var(--app-text-secondary)]">
            <span className="font-medium text-[var(--app-text-primary)]">{job.company}</span>
            {job.location ? (
              <>
                {" "}
                · {job.location}
              </>
            ) : null}
            {job.seniority ? (
              <>
                {" "}
                · {job.seniority}
              </>
            ) : null}
          </p>
          {job.description ? (
            <p className="line-clamp-3 text-[13px] leading-6 text-[var(--app-text-secondary)]">{job.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {listingSourceLabel(job.listing_source) ? (
              <span className="text-[12px] text-[var(--app-text-tertiary)]">
                Source:{" "}
                <span className="font-medium text-[var(--app-text-secondary)]">
                  {listingSourceLabel(job.listing_source)}
                </span>
              </span>
            ) : null}
            {formatListedAt(job.source_posted_at ?? undefined) ? (
              <span className="text-[12px] text-[var(--app-text-tertiary)]">
                Listed {formatListedAt(job.source_posted_at ?? undefined)}
              </span>
            ) : formatListedAt(job.created_at) ? (
              <span className="text-[12px] text-[var(--app-text-tertiary)]">
                Added {formatListedAt(job.created_at)}
              </span>
            ) : null}
            {job.source_url ? (
              <Link
                href={job.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[12px] font-medium text-[var(--app-accent)] underline-offset-4 hover:underline"
                onClick={() => {
                  onClickOut(job.id, {
                    tab,
                    url: job.source_url,
                    listing_source: job.listing_source ?? null,
                  });
                }}
              >
                View posting
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-start gap-4 sm:flex-col sm:items-end">
          {showMatchRing ? (
            <ScoreBadge
              label={similarity !== null ? "Match" : "Rank"}
              value={similarity ?? score ?? 0}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/discovery/${job.id}`}
              className="inline-flex h-8 items-center justify-center rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 text-[12px] font-medium text-[var(--app-text-primary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
            >
              Details
            </Link>
            <AppButton
              size="sm"
              variant="outline"
              disabled={fitLoadingId === job.id}
              onClick={() => {
                if (fit) {
                  onToggleFit(job.id);
                } else {
                  void onFit(job.id);
                }
              }}
            >
              {fitLoadingId === job.id ? "Scoring…" : fit ? (open ? "Hide fit" : "Show fit") : "AI fit"}
            </AppButton>
            <AppButton
              size="sm"
              variant="outline"
              disabled={feedbackBusyId === job.id}
              onClick={() => onUpvote(job.id)}
              title="Tell us this job is a good match"
            >
              {feedbackBusyId === job.id ? "Working…" : "Upvote"}
            </AppButton>
            <AppButton
              size="sm"
              variant="outline"
              disabled={feedbackBusyId === job.id}
              onClick={() => onToggleDownvote(job.id)}
              title="Tell us this job is not a good match"
            >
              {feedbackBusyId === job.id ? "Working…" : "Downvote"}
            </AppButton>
            <AppButton
              size="sm"
              variant="outline"
              disabled={hideBusyId === job.id}
              onClick={() => onHide(job.id)}
              title="Hide this job from your feed"
            >
              {hideBusyId === job.id ? "Working…" : (hideLabel ?? "Hide")}
            </AppButton>
          </div>
        </div>
      </div>

      {downvoteOpenId === job.id ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--app-border)] pt-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Why is this a bad fit?
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={downvoteReason}
              onChange={(e) => onChangeDownvoteReason(e.target.value)}
              className="w-full max-w-xl rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus:border-[color:var(--app-focus-border)]"
            >
              <option value="">Select a reason…</option>
              <option value="irrelevant_role">Role is irrelevant</option>
              <option value="wrong_level">Seniority/level mismatch</option>
              <option value="wrong_location">Location mismatch</option>
              <option value="pay_too_low">Compensation too low</option>
              <option value="not_remote">Not remote / remote mismatch</option>
              <option value="duplicate">Duplicate listing</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2">
              <AppButton
                size="sm"
                variant="primary"
                disabled={feedbackBusyId === job.id || !downvoteReason}
                onClick={() => onDownvote(job.id, downvoteReason)}
              >
                Submit
              </AppButton>
              <AppButton size="sm" variant="outline" disabled={feedbackBusyId === job.id} onClick={() => onToggleDownvote(job.id)}>
                Cancel
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      {open && fit ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-4 border-t border-[var(--app-border)] pt-4 text-[13px] leading-6 text-[var(--app-text-secondary)]"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                Scores
              </div>
              <p className="mt-1 tabular-nums text-[var(--app-text-primary)]">
                Fit {Math.round(fit.score)} · Alignment {Math.round(fit.match_pct)}%
              </p>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                Strengths
              </div>
              <p className="mt-1">{fit.strength_skills.length ? fit.strength_skills.join(", ") : "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-pretty">{fit.rationale}</p>
          {fit.gap_skills.length ? (
            <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
              Gaps: {fit.gap_skills.join(", ")}
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

export function DiscoveryClient({
  initialFeed,
  initialJobs,
  initialHiddenJobs,
  loadError,
}: {
  initialFeed: FeedRow[];
  initialJobs: JobRow[];
  initialHiddenJobs: JobRow[];
  loadError: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("feed");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeKind, setScrapeKind] = useState<"url" | "rss">("url");
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [remoteOkBusy, setRemoteOkBusy] = useState(false);
  const [adzunaBusy, setAdzunaBusy] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [fitData, setFitData] = useState<Record<string, FitScoreResponse>>({});
  const [fitLoadingId, setFitLoadingId] = useState<string | null>(null);
  const [expandedFitId, setExpandedFitId] = useState<string | null>(null);
  const [hideBusyId, setHideBusyId] = useState<string | null>(null);
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [downvoteOpenId, setDownvoteOpenId] = useState<string | null>(null);
  const [downvoteReason, setDownvoteReason] = useState("");
  const impressedIdsRef = useRef<Set<string>>(new Set());

  async function trackEvent(jobId: string, payload: { event_type: string; reason?: string; meta?: unknown }) {
    try {
      await fetch(`/api/jobs/${jobId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // best-effort only
    }
  }

  function onImpression(jobId: string, meta: Record<string, unknown>) {
    if (impressedIdsRef.current.has(jobId)) return;
    impressedIdsRef.current.add(jobId);
    void trackEvent(jobId, { event_type: "impression", meta });
  }

  function onClickOut(jobId: string, meta: Record<string, unknown>) {
    void trackEvent(jobId, { event_type: "click_out", meta });
  }

  const feedRows = useMemo(() => initialFeed, [initialFeed]);
  const allRows: FeedRow[] = useMemo(
    () =>
      initialJobs.map((j) => ({
        job: j,
        score: 0,
        similarity: null,
      })),
    [initialJobs],
  );
  const hiddenRows: FeedRow[] = useMemo(
    () =>
      initialHiddenJobs.map((j) => ({
        job: j,
        score: 0,
        similarity: null,
      })),
    [initialHiddenJobs],
  );

  async function submitScrape(e: React.FormEvent) {
    e.preventDefault();
    setScrapeMsg(null);
    const url = scrapeUrl.trim();
    if (!url) return;
    setScrapeBusy(true);
    try {
      const resp = await fetch("/api/jobs/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, kind: scrapeKind }),
      });
      const data = (await resp.json().catch(() => ({}))) as { task_id?: string; detail?: string };
      if (resp.ok && data.task_id) {
        setScrapeMsg(
          scrapeKind === "rss"
            ? `RSS ingest queued (task ${data.task_id}). Child scrapes run in the background.`
            : `Scrape queued (task ${data.task_id}). Refresh in a few seconds for new roles.`,
        );
        setScrapeUrl("");
        router.refresh();
      } else {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Request failed (${resp.status})`);
      }
    } finally {
      setScrapeBusy(false);
    }
  }

  async function queueRemoteOkSync() {
    setScrapeMsg(null);
    setRemoteOkBusy(true);
    try {
      const resp = await fetch("/api/jobs/ingest/remoteok", { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as { task_id?: string; detail?: string };
      if (resp.ok && data.task_id) {
        setScrapeMsg(
          `Remote OK ingest queued (task ${data.task_id}). New roles appear after the worker runs; refresh shortly.`,
        );
        router.refresh();
      } else {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Request failed (${resp.status})`);
      }
    } finally {
      setRemoteOkBusy(false);
    }
  }

  async function queueAdzunaSync() {
    setScrapeMsg(null);
    setAdzunaBusy(true);
    try {
      const resp = await fetch("/api/jobs/ingest/adzuna", { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as {
        task_id?: string;
        detail?: string;
        status?: string;
      };
      if (resp.ok && data.task_id) {
        setScrapeMsg(
          `Adzuna ingest queued (task ${data.task_id}). Requires API keys on the server; refresh after workers run.`,
        );
        router.refresh();
      } else {
        setScrapeMsg(
          typeof data.detail === "string" ? data.detail : `Adzuna request failed (${resp.status})`,
        );
      }
    } finally {
      setAdzunaBusy(false);
    }
  }

  async function runFit(jobId: string) {
    setFitLoadingId(jobId);
    setScrapeMsg(null);
    try {
      const resp = await fetch(`/api/jobs/${jobId}/fit`, { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as FitScoreResponse & { detail?: string };
      if (resp.ok && typeof data.score === "number") {
        setFitData((m) => ({ ...m, [jobId]: data }));
        setExpandedFitId(jobId);
      } else {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Fit scoring failed (${resp.status})`);
      }
    } finally {
      setFitLoadingId(null);
    }
  }

  async function hideJob(jobId: string) {
    setHideBusyId(jobId);
    setScrapeMsg(null);
    try {
      const resp = await fetch(`/api/jobs/${jobId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "hide" }),
      });
      const data = (await resp.json().catch(() => ({}))) as { detail?: string };
      if (!resp.ok) {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Hide failed (${resp.status})`);
        return;
      }
      router.refresh();
    } finally {
      setHideBusyId(null);
    }
  }

  async function unhideJob(jobId: string) {
    setHideBusyId(jobId);
    setScrapeMsg(null);
    try {
      const resp = await fetch(`/api/jobs/${jobId}/feedback`, { method: "DELETE" });
      const data = (await resp.json().catch(() => ({}))) as { detail?: string };
      if (!resp.ok) {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Undo failed (${resp.status})`);
        return;
      }
      router.refresh();
    } finally {
      setHideBusyId(null);
    }
  }

  function toggleDownvote(jobId: string) {
    setDownvoteReason("");
    setDownvoteOpenId((cur) => (cur === jobId ? null : jobId));
  }

  async function upvoteJob(jobId: string) {
    setFeedbackBusyId(jobId);
    setScrapeMsg(null);
    try {
      const resp = await fetch(`/api/jobs/${jobId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "upvote" }),
      });
      const data = (await resp.json().catch(() => ({}))) as { detail?: string };
      if (!resp.ok) {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Upvote failed (${resp.status})`);
        return;
      }
      router.refresh();
    } finally {
      setFeedbackBusyId(null);
    }
  }

  async function downvoteJob(jobId: string, reason: string) {
    setFeedbackBusyId(jobId);
    setScrapeMsg(null);
    try {
      const resp = await fetch(`/api/jobs/${jobId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "downvote", reason }),
      });
      const data = (await resp.json().catch(() => ({}))) as { detail?: string };
      if (!resp.ok) {
        setScrapeMsg(typeof data.detail === "string" ? data.detail : `Downvote failed (${resp.status})`);
        return;
      }
      setDownvoteOpenId(null);
      setDownvoteReason("");
      router.refresh();
    } finally {
      setFeedbackBusyId(null);
    }
  }

  const list = tab === "feed" ? feedRows : tab === "hidden" ? hiddenRows : allRows;

  const apiBaseHint = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Job Discovery
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          Open a role for the full posting, then <span className="font-medium text-[var(--app-text-primary)]">Generate outreach</span>{" "}
          to draft messages under human review. Ranking uses your résumé (embeddings when enabled, otherwise profile
          heuristics). Import a posting URL or RSS, or use optional Remote OK / Adzuna syncs—tune Adzuna in env for your
          sector.
        </p>
        <div className="mt-4">
          <JobPipelineHint variant="discovery" />
        </div>
      </div>

      <DiscoveryCoverageNotice />

      {loadError ? (
        <div
          role="alert"
          className="rounded-[var(--app-radius-lg)] border border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-bg-elevated))] px-4 py-4 sm:px-5 sm:py-5"
        >
          <p className="text-[14px] font-semibold tracking-tight text-[var(--app-text-primary)]">Couldn&apos;t load jobs</p>
          <p className="mt-2 max-w-2xl text-pretty text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            The workspace couldn&apos;t reach your API with a valid session. Fix the items below, then refresh this page.
          </p>
          <ul className="mt-4 list-none space-y-2.5 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-semibold text-[var(--app-accent)]">1.</span>
              <span>
                API reachable at{" "}
                <code className="rounded bg-[var(--app-bg-muted)] px-1.5 py-0.5 font-app-mono text-[11px] text-[var(--app-text-primary)]">
                  {apiBaseHint}
                </code>{" "}
                (set <code className="font-app-mono text-[11px]">NEXT_PUBLIC_API_BASE_URL</code> in <code className="font-app-mono text-[11px]">web/.env</code>).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-semibold text-[var(--app-accent)]">2.</span>
              <span>
                Signed in with Clerk; JWT template{" "}
                <code className="rounded bg-[var(--app-bg-muted)] px-1.5 py-0.5 font-app-mono text-[11px]">doubow-api</code>{" "}
                audience matches API <code className="font-app-mono text-[11px]">DOUBOW_CLERK_AUDIENCE</code>.
              </span>
            </li>
          </ul>
        </div>
      ) : null}

      <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Import
        </div>
        <form className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end" onSubmit={submitScrape}>
          <div className="min-w-0 flex-1 space-y-2">
            <label className="text-[13px] font-medium text-[var(--app-text-primary)]" htmlFor="scrape-url">
              URL
            </label>
            <input
              id="scrape-url"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none ring-[color:var(--app-focus-ring)] placeholder:text-[var(--app-text-tertiary)] focus:border-[color:var(--app-focus-border)] focus:ring-2"
            />
          </div>
          <div className="flex gap-2 lg:shrink-0">
            {(["url", "rss"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={cn(
                  "rounded-[var(--app-radius-pill)] px-4 py-2 text-[12px] font-medium transition-colors",
                  scrapeKind === k
                    ? "bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] text-[var(--app-text-primary)]"
                    : "bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-sidebar-hover-bg)]",
                )}
                onClick={() => setScrapeKind(k)}
              >
                {k === "url" ? "Single posting" : "RSS feed"}
              </button>
            ))}
          </div>
          <AppButton
            className="lg:shrink-0"
            disabled={scrapeBusy || remoteOkBusy || adzunaBusy}
            type="submit"
            variant="primary"
          >
            {scrapeBusy ? "Queueing…" : "Queue"}
          </AppButton>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AppButton
            disabled={remoteOkBusy || scrapeBusy || adzunaBusy}
            type="button"
            variant="outline"
            onClick={() => void queueRemoteOkSync()}
          >
            {remoteOkBusy ? "Queueing…" : "Sync Remote OK"}
          </AppButton>
          <AppButton
            disabled={adzunaBusy || scrapeBusy || remoteOkBusy}
            type="button"
            variant="outline"
            onClick={() => void queueAdzunaSync()}
          >
            {adzunaBusy ? "Queueing…" : "Sync Adzuna"}
          </AppButton>
          <p className="max-w-xl text-[12px] leading-5 text-[var(--app-text-tertiary)]">
            Optional bulk samples—tune Adzuna keywords in server env for your field. Source and listed date on each card.
          </p>
        </div>
        {scrapeMsg ? (
          <p className="mt-3 text-[13px] leading-6 text-[var(--app-text-secondary)]">{scrapeMsg}</p>
        ) : null}
      </section>

      <div
        className="flex flex-wrap gap-2 border-b border-[var(--app-border)] pb-3"
        role="tablist"
        aria-label="Job list views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "feed"}
          id="discovery-tab-feed"
          className={cn(
            "rounded-[var(--app-radius-pill)] px-4 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]",
            tab === "feed"
              ? "bg-[var(--app-bg-elevated)] text-[var(--app-text-primary)] shadow-[0_1px_0_rgba(255,255,255,0.06)]"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]",
          )}
          onClick={() => setTab("feed")}
        >
          For you
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          id="discovery-tab-all"
          className={cn(
            "rounded-[var(--app-radius-pill)] px-4 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]",
            tab === "all"
              ? "bg-[var(--app-bg-elevated)] text-[var(--app-text-primary)] shadow-[0_1px_0_rgba(255,255,255,0.06)]"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]",
          )}
          onClick={() => setTab("all")}
        >
          All roles
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "hidden"}
          id="discovery-tab-hidden"
          className={cn(
            "rounded-[var(--app-radius-pill)] px-4 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]",
            tab === "hidden"
              ? "bg-[var(--app-bg-elevated)] text-[var(--app-text-primary)] shadow-[0_1px_0_rgba(255,255,255,0.06)]"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]",
          )}
          onClick={() => setTab("hidden")}
        >
          Hidden
        </button>
      </div>

      {!loadError && tab === "feed" && feedRows.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-dashed border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-10 text-center text-pretty text-[13px] leading-7 text-[var(--app-text-secondary)]">
          No personalized rows yet. Embed a résumé on the Dashboard (with OpenAI configured), add jobs via{" "}
          <span className="font-medium text-[var(--app-text-primary)]">Import</span>, or switch to{" "}
          <span className="font-medium text-[var(--app-text-primary)]">All roles</span>. When listings appear, use{" "}
          <span className="font-medium text-[var(--app-text-primary)]">Details</span> →{" "}
          <span className="font-medium text-[var(--app-text-primary)]">Generate outreach</span> →{" "}
          <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
            Approvals
          </Link>
          .
        </div>
      ) : !loadError && tab === "hidden" && hiddenRows.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-dashed border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-10 text-center text-pretty text-[13px] leading-7 text-[var(--app-text-secondary)]">
          Nothing hidden yet. Use{" "}
          <span className="font-medium text-[var(--app-text-primary)]">Hide</span> on a card to remove it from your feed.
        </div>
      ) : !loadError && tab === "all" && allRows.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-dashed border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-10 text-center text-pretty text-[13px] leading-7 text-[var(--app-text-secondary)]">
          No roles in the catalog yet. Queue a URL or RSS under{" "}
          <span className="font-medium text-[var(--app-text-primary)]">Import</span>, or run a bulk sync, then refresh.
        </div>
      ) : !loadError ? (
        <div className="flex flex-col gap-4">
          {list.map((row, i) => (
            <motion.div
              key={row.job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.4) }}
            >
              <JobCard
                expandedFitId={expandedFitId}
                fitData={fitData}
                fitLoadingId={fitLoadingId}
                hideBusyId={hideBusyId}
                feedbackBusyId={feedbackBusyId}
                downvoteOpenId={downvoteOpenId}
                downvoteReason={downvoteReason}
                row={row}
                tab={tab}
                onFit={runFit}
                onToggleDownvote={toggleDownvote}
                onChangeDownvoteReason={setDownvoteReason}
                onUpvote={upvoteJob}
                onDownvote={downvoteJob}
                onHide={tab === "hidden" ? unhideJob : hideJob}
                hideLabel={tab === "hidden" ? "Undo hide" : "Hide"}
                onToggleFit={(id) => setExpandedFitId((cur) => (cur === id ? null : id))}
                onImpression={onImpression}
                onClickOut={onClickOut}
              />
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
