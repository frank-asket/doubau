"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

type TabKey = "feed" | "all";

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
}: {
  row: FeedRow;
  tab: TabKey;
  fitData: Record<string, FitScoreResponse>;
  fitLoadingId: string | null;
  expandedFitId: string | null;
  onFit: (jobId: string) => void;
  onToggleFit: (jobId: string) => void;
}) {
  const job = row.job;
  const score = row.score;
  const similarity = row.similarity;
  const showMatchRing = tab === "feed";

  const fit = fitData[job.id];
  const open = expandedFitId === job.id;

  return (
    <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 transition-colors hover:border-[var(--app-border-strong,#ffffff14)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-pretty text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
              {job.title}
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
                className="inline-block text-[12px] font-medium text-[color:rgba(26,92,255,0.95)] underline-offset-4 hover:underline"
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
          </div>
        </div>
      </div>

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
  loadError,
}: {
  initialFeed: FeedRow[];
  initialJobs: JobRow[];
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

  const list = tab === "feed" ? feedRows : allRows;

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Job Discovery
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          Fit ranking follows your résumé across industries and role types—not only tech. With embeddings on we rank by
          semantic match; otherwise profile heuristics. Import any posting URL or RSS feed for your field; optional
          Remote OK / Adzuna syncs add samples (Remote OK skews remote/tech—tune Adzuna keywords in env for your sector).
        </p>
      </div>

      {loadError ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[color:rgba(220,38,38,0.35)] bg-[color:rgba(220,38,38,0.08)] px-4 py-3 text-[13px] text-[var(--app-text-primary)]">
          Could not load jobs from the API. Check you are signed in and the backend is running.
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
              className="w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none ring-[color:rgba(26,92,255,0.35)] placeholder:text-[var(--app-text-tertiary)] focus:border-[color:rgba(26,92,255,0.45)] focus:ring-2"
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
                    ? "bg-[color:rgba(26,92,255,0.18)] text-[var(--app-text-primary)]"
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

      <div className="flex flex-wrap gap-2 border-b border-[var(--app-border)] pb-3">
        <button
          type="button"
          className={cn(
            "rounded-[var(--app-radius-pill)] px-4 py-1.5 text-[13px] font-medium transition-colors",
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
          className={cn(
            "rounded-[var(--app-radius-pill)] px-4 py-1.5 text-[13px] font-medium transition-colors",
            tab === "all"
              ? "bg-[var(--app-bg-elevated)] text-[var(--app-text-primary)] shadow-[0_1px_0_rgba(255,255,255,0.06)]"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]",
          )}
          onClick={() => setTab("all")}
        >
          All roles
        </button>
      </div>

      {tab === "feed" && feedRows.length === 0 ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-dashed border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-8 text-center text-[13px] leading-6 text-[var(--app-text-secondary)]">
          No personalized rows yet. Embed a résumé on the Dashboard (with OpenAI configured), add jobs via{" "}
          <span className="font-medium text-[var(--app-text-primary)]">Import</span>, or switch to{" "}
          <span className="font-medium text-[var(--app-text-primary)]">All roles</span>.
        </div>
      ) : (
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
                row={row}
                tab={tab}
                onFit={runFit}
                onToggleFit={(id) => setExpandedFitId((cur) => (cur === id ? null : id))}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
