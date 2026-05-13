"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";

import { JobCompanyMark } from "@/components/discovery/JobCompanyMark";
import { ChromeIconButton, ChromePrimaryButton } from "@/components/ui/chrome-motion";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

/** Public runbook (override with NEXT_PUBLIC_LAUNCH_DOCS_URL for forks). */
const DEFAULT_LAUNCH_DOCS_HREF =
  "https://github.com/frank-asket/doubau/blob/main/docs/LAUNCH_WEEK.md";

function launchDocsHref(): string {
  const u = (process.env.NEXT_PUBLIC_LAUNCH_DOCS_URL ?? "").trim();
  return u || DEFAULT_LAUNCH_DOCS_HREF;
}

function discoveryPrefsHref(match: "default" | "worldwide", remoteOnly: boolean): string {
  const p = new URLSearchParams();
  if (match === "worldwide") p.set("match_scope", "worldwide");
  if (remoteOnly) p.set("remote_only", "true");
  return p.toString() ? `/app/discovery?${p.toString()}` : "/app/discovery";
}

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
  score_reason?: string;
  score_components?: Record<string, number>;
};

export type CatalogSummary = {
  active_total: number;
  embedded_total: number;
  missing_embedding_total: number;
  with_source_url_total: number;
  by_source: Record<string, number>;
  by_location: Record<string, number>;
  stale_after_days: number;
};

type TabKey = "all" | "favorites";

type DisplayRow = {
  job: JobRow;
  score: number | null;
  similarity: number | null;
  scoreReason: string | null;
  components: Record<string, number>;
};

function Tag({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={`ch-pill ${active ? "bg-[var(--app-blue-50)] text-[var(--app-accent)]" : ""}`}>
      {children}
    </span>
  );
}

function postedLabel(job: JobRow) {
  const raw = job.source_posted_at || job.created_at;
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return "Recently added";
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  return `${days} days ago`;
}

function normalizedJob(job: JobRow): JobRow {
  return {
    ...job,
    title: job.title || "Untitled role",
    company: job.company || "Unknown company",
    seniority: job.seniority || "Experience not specified",
    employment_type: job.employment_type || "Employment type not specified",
    location: job.location || "Location not specified",
    description: job.description || "No description was provided by the source.",
  };
}

function normalizedRow(row: DisplayRow): DisplayRow {
  return {
    ...row,
    job: normalizedJob(row.job),
  };
}

/** Office / Remote / Hybrid chip from catalog location text (aligned with feed ``remote_only`` heuristics). */
function workModeFromLocation(location: string | null | undefined): "Remote" | "Hybrid" | "Office" {
  const s = (location || "").toLowerCase();
  if (!s.trim()) return "Office";
  if (/\bhybrid\b/.test(s)) return "Hybrid";
  if (
    /\bremote\b/.test(s) ||
    /\banywhere\b/.test(s) ||
    /\bworldwide\b/.test(s) ||
    /\bdistributed\b/.test(s) ||
    /\bwfh\b/.test(s) ||
    /\bwork from home\b/.test(s) ||
    /\bfully\s+remote\b/.test(s)
  ) {
    return "Remote";
  }
  return "Office";
}

function isPreviewJob(job: JobRow) {
  return job.id.startsWith("mock-");
}

function DiscoveryScoringExplainer({
  resumeStatus,
  catalogSummary,
}: {
  resumeStatus: string | null | undefined;
  catalogSummary: CatalogSummary | null;
}) {
  const active = catalogSummary?.active_total ?? 0;
  const embeddedJobs = catalogSummary?.embedded_total ?? 0;
  const missingJobEmb = catalogSummary?.missing_embedding_total ?? 0;
  const resumeEmbedded = resumeStatus === "EMBEDDED";
  const catalogEmpty = active === 0;
  const semanticRankingLikely = resumeEmbedded && embeddedJobs > 0 && active > 0;

  let rankingChipLabel: string;
  let rankingChipClass: string;
  if (catalogEmpty) {
    rankingChipLabel = "No jobs in catalog yet";
    rankingChipClass =
      "bg-[color-mix(in_srgb,var(--app-warning)_12%,var(--app-bg-muted))] text-[var(--app-text-primary)]";
  } else if (semanticRankingLikely) {
    rankingChipLabel = "Semantic ranking likely active";
    rankingChipClass = "bg-[color-mix(in_srgb,var(--app-success)_15%,transparent)] text-[var(--app-success)]";
  } else if (active > 0 && embeddedJobs === 0 && resumeEmbedded) {
    rankingChipLabel = "Heuristic until job embeddings finish";
    rankingChipClass = "bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)]";
  } else if (active > 0 && !resumeEmbedded) {
    rankingChipLabel = "Heuristic until résumé is embedded";
    rankingChipClass = "bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)]";
  } else {
    rankingChipLabel = "Heuristic / partial semantic ranking";
    rankingChipClass = "bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)]";
  }

  return (
    <details className="group mb-6 rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_05%,var(--app-bg-elevated))] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--app-accent)]">Ranking</p>
          <p className="mt-0.5 text-[13px] font-semibold text-[var(--app-text-primary)]">How listings are matched to your profile</p>
        </div>
        <AppIcon
          name="chevron-down"
          className="size-5 shrink-0 text-[var(--app-text-tertiary)] transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-[color-mix(in_srgb,var(--app-border)_80%,transparent)] px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span
            className={`rounded-full px-3 py-1 font-medium ${
              resumeEmbedded
                ? "bg-[color-mix(in_srgb,var(--app-success)_15%,transparent)] text-[var(--app-success)]"
                : "bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)]"
            }`}
          >
            Résumé: {resumeStatus ?? "unknown"}
          </span>
          <span className="rounded-full bg-[var(--app-bg-muted)] px-3 py-1 font-medium text-[var(--app-text-secondary)]">
            Catalog: {active} active · {embeddedJobs} with embeddings
            {missingJobEmb > 0 ? ` · ${missingJobEmb} still indexing` : ""}
          </span>
          <span className={`rounded-full px-3 py-1 font-medium ${rankingChipClass}`}>{rankingChipLabel}</span>
        </div>

      {catalogEmpty ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
          <span className="font-medium text-[var(--app-text-primary)]">No listings yet.</span> Jobs arrive after provider ingest or an
          import; refresh after your pipeline runs.{" "}
          <a
            href={launchDocsHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--app-accent)] underline decoration-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] underline-offset-2 hover:opacity-90"
          >
            Launch runbook
          </a>
        </p>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
          When your résumé and catalog jobs are both embedded, we can rank by semantic fit to your CV; otherwise you still get ranked
          results from your profile, goals, location, seniority, and freshness.
        </p>
      )}

      <details className="mt-3 rounded-[var(--app-radius-md)] border border-dashed border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_04%,transparent)] px-3 py-2 text-[12px] text-[var(--app-text-secondary)]">
        <summary className="cursor-pointer select-none font-medium text-[var(--app-text-primary)] outline-none marker:text-[var(--app-text-tertiary)]">
          Technical details (self-hosted / ops)
        </summary>
        {catalogEmpty ? (
          <div className="mt-3 rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-warning)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-warning)_08%,var(--app-bg-elevated))] px-3 py-3 text-[13px] leading-relaxed">
            <p className="font-medium text-[var(--app-text-primary)]">Catalog empty</p>
            <p className="mt-2">
              Ingest (Remote OK / Adzuna / Scrapling) plus a <strong className="text-[var(--app-text-primary)]">Celery worker</strong> and{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">Redis</code> keep{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">active_total</code> moving. Set{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">DOUBOW_REDIS_URL</code>, run worker + beat (or{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">DOUBOW_START_WORKER_IN_API</code> /{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">DOUBOW_BOOTSTRAP_INGEST_ON_STARTUP</code>), and{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">DOUBOW_OPENAI_API_KEY</code> for{" "}
              <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">embed_job</code>.
            </p>
          </div>
        ) : null}
        <ul className={`mt-3 list-disc space-y-2 pl-5 ${catalogEmpty ? "opacity-90" : ""}`}>
          <li>
            <span className="font-medium text-[var(--app-text-primary)]">Semantic CV match</span> (résumé + job embeddings) needs your
            latest résumé <strong className="text-[var(--app-text-primary)]">EMBEDDED</strong>,{" "}
            <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">DOUBOW_OPENAI_API_KEY</code> on the API, and job
            embeddings from Celery <code className="rounded bg-[var(--app-bg-muted)] px-1 text-[11px]">embed_job</code> after ingest.
          </li>
          <li>
            Otherwise the feed ranks using{" "}
            <span className="font-medium text-[var(--app-text-primary)]">persona, goals, location, seniority</span>, and freshness — not
            full-text résumé similarity.
          </li>
          <li>
            New jobs appear after <strong className="text-[var(--app-text-primary)]">ingest</strong> (Remote OK / Adzuna / Scrapling) or{" "}
            <strong className="text-[var(--app-text-primary)]">import URL</strong>, processed by your worker queue.
          </li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
          {catalogEmpty
            ? "After ingest runs, refresh — counts update on each load."
            : "Résumé parse status lives on the dashboard; workers + OpenAI on the API unlock the full embedding-backed path."}{" "}
          <a
            href={launchDocsHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
          >
            Launch runbook
          </a>
        </p>
      </details>
      </div>
    </details>
  );
}

function showCatalogSourceDebugUi(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    (process.env.NEXT_PUBLIC_SHOW_CATALOG_SOURCE_DEBUG ?? "").trim().toLowerCase() === "true"
  );
}

function DiscoveryCatalogSourceDebug({ summary }: { summary: CatalogSummary }) {
  const entries = Object.entries(summary.by_source).sort((a, b) => b[1] - a[1]);
  return (
    <details className="mb-5 rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] px-4 py-3 text-[13px] text-[var(--app-text-secondary)]">
      <summary className="cursor-pointer select-none font-semibold text-[var(--app-text-primary)] outline-none marker:text-[var(--app-text-tertiary)]">
        Catalog by listing_source (debug)
      </summary>
      <p className="mt-3 text-[12px] leading-relaxed text-[var(--app-text-tertiary)]">
        Counts are active non-stale jobs in Postgres (same filters as{" "}
        <code className="rounded bg-[var(--app-bg-elevated)] px-1 text-[11px]">/jobs/catalog/summary</code>). Discovery loads at most 100
        feed rows + 100 recent jobs — not every row.
      </p>
      {entries.length === 0 ? (
        <p className="mt-2 text-[12px] font-medium text-[var(--app-warning)]">No rows in by_source — catalog empty or all outside the stale window.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {entries.map(([src, n]) => (
            <li
              key={src}
              className="rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1 font-mono text-[12px] tabular-nums text-[var(--app-text-primary)]"
            >
              <span className="text-[var(--app-text-secondary)]">{src}</span>{" "}
              <span className="font-semibold text-[var(--app-accent)]">{n}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-[var(--app-text-tertiary)]">
        Stale after {summary.stale_after_days}d · embedded {summary.embedded_total} / {summary.active_total} active
      </p>
    </details>
  );
}

function sourceLabel(job: JobRow) {
  if (job.listing_source === "remoteok") return "RemoteOK";
  if (job.listing_source === "adzuna") return "Adzuna";
  if (job.listing_source === "http_fetch") return "Imported";
  if (job.listing_source === "greenhouse") return "Greenhouse";
  if (job.listing_source === "scrapling_jsonld" || job.listing_source === "scrapling") return "Scrapling";
  if (job.listing_source) return job.listing_source.replace(/_/g, " ");
  return "Doubow";
}

async function postJobEvent(jobId: string, eventType: "click_out" | "save" | "dismiss", reason?: string) {
  if (!jobId || isPreviewJob({ id: jobId } as JobRow)) return;
  await fetch(`/api/jobs/${encodeURIComponent(jobId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_type: eventType, reason }),
  }).catch(() => undefined);
}

function ToolbarButton({ label, icon }: { label: string; icon: AppIconName }) {
  return (
    <ChromeIconButton
      aria-label={label}
      title={label}
      className="size-9 border border-transparent text-[var(--app-text-secondary)] shadow-none transition-colors hover:border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] hover:bg-[color-mix(in_srgb,var(--app-accent)_07%,var(--app-bg-elevated))] hover:text-[var(--app-accent)]"
    >
      <AppIcon name={icon} className="size-[18px]" />
    </ChromeIconButton>
  );
}

function DiscoveryCard({
  row,
  index,
  favorite,
  onToggleFavorite,
  onHide,
}: {
  row: DisplayRow;
  index: number;
  favorite: boolean;
  onToggleFavorite: () => void;
  onHide: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const job = row.job;
  const workMode = workModeFromLocation(job.location);
  const tags = [job.seniority || "3 year exp", job.employment_type || "Full time", workMode];
  const detailHref = isPreviewJob(job) ? "#" : `/app/discovery/${job.id}`;
  const rawListingUrl = job.source_url?.trim() ?? "";
  const listingIsExternal = Boolean(rawListingUrl && /^https?:\/\//i.test(rawListingUrl));
  const listingHref =
    !isPreviewJob(job) && listingIsExternal ? rawListingUrl : detailHref;
  const description = job.description || "";
  const score = typeof row.score === "number" ? Math.round(row.score) : null;
  const components = Object.entries(row.components || {}).slice(0, 3);

  const linkClass =
    "grid size-10 shrink-0 place-items-center rounded-full border border-transparent text-[var(--app-text-secondary)] transition-colors duration-150 ease-out hover:border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-accent)]";

  return (
    <motion.article
      className="group/card ch-soft-card relative flex h-full flex-col overflow-hidden rounded-[22px] p-5"
      initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.26, delay: reducedMotion ? 0 : Math.min(index * 0.03, 0.22) }}
    >
      {!isPreviewJob(job) ? (
        <Link
          href={detailHref}
          className="absolute inset-0 z-10 rounded-[22px] outline-none ring-[var(--app-accent)] focus-visible:z-30 focus-visible:ring-2"
          aria-label={`View job: ${job.title} at ${job.company}`}
        />
      ) : null}
      <div className="relative z-20 flex min-h-0 flex-1 flex-col pointer-events-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <JobCompanyMark company={job.company} sourceUrl={job.source_url} size="card" />
            <div className="min-w-0 pr-1">
              {!isPreviewJob(job) ? (
                <>
                  <h2 className="truncate text-[17px] font-bold tracking-[-0.02em] text-[var(--app-text-primary)] group-hover/card:text-[var(--app-accent)]">
                    {job.title}
                  </h2>
                  <p className="mt-0.5 truncate text-[14px] font-semibold text-[var(--app-text-secondary)]">{job.company}</p>
                </>
              ) : (
                <>
                  <h2 className="truncate text-[17px] font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">{job.title}</h2>
                  <p className="mt-0.5 truncate text-[14px] font-semibold text-[var(--app-text-secondary)]">{job.company}</p>
                </>
              )}
            </div>
          </div>
          <motion.button
            type="button"
            className={`pointer-events-auto relative z-20 grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 ease-out ${favorite ? "bg-[color-mix(in_srgb,var(--app-accent)_14%,white)] text-[var(--app-accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--app-accent)_18%,transparent)]" : "text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-accent)]"}`}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            title={favorite ? "Remove from favorites" : "Save to favorites"}
            onClick={onToggleFavorite}
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
          >
            <motion.span
              key={favorite ? "on" : "off"}
              initial={reducedMotion ? false : { scale: 0.86, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="grid place-items-center"
            >
              <AppIcon name={favorite ? "star-filled" : "star"} filled={favorite} className="size-5" />
            </motion.span>
          </motion.button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag key={`${job.id}-${tag}`}>{tag}</Tag>
          ))}
        </div>

        <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-[14px] leading-[1.55] text-[var(--app-text-primary)]">{description}</p>

        <p className="mt-2 line-clamp-1 text-[12px] text-[var(--app-text-tertiary)]">
          <span className="font-medium text-[var(--app-text-secondary)]">{sourceLabel(job)}</span>
          <span aria-hidden className="mx-1.5 text-[var(--app-border)]">
            ·
          </span>
          <span>{postedLabel(job)}</span>
          {score !== null ? (
            <>
              <span aria-hidden className="mx-1.5 text-[var(--app-border)]">
                ·
              </span>
              <span className="font-semibold text-[var(--app-accent)]">{score}% match</span>
            </>
          ) : null}
        </p>

        {row.scoreReason ? (
          <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-[var(--app-text-secondary)]">{row.scoreReason}</p>
        ) : null}

        {components.length ? (
          <details className="pointer-events-auto mt-3 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/60 px-2 py-1.5 text-[11px] text-[var(--app-text-tertiary)]">
            <summary className="cursor-pointer select-none font-semibold text-[var(--app-text-secondary)] [&::-webkit-details-marker]:hidden">
              Score breakdown
            </summary>
            <div className="mt-2 grid gap-2 pb-1">
              {components.map(([name, value]) => (
                <div
                  key={name}
                  className="grid grid-cols-[88px_1fr_40px] items-center gap-2 font-bold uppercase tracking-[0.06em]"
                >
                  <span className="truncate">{name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
                    <span
                      className="block h-full rounded-full bg-[var(--app-accent)]"
                      style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-[var(--app-text-primary)]">{Math.round(value)}%</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-[color-mix(in_srgb,var(--app-border)_85%,transparent)] pt-4">
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[var(--app-text-primary)]">
            <AppIcon name="banknote" className="size-4 shrink-0 text-[var(--app-text-tertiary)]" />
            <span className="truncate text-[var(--app-text-secondary)]">See posting for salary</span>
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {!isPreviewJob(job) ? (
              <motion.button
                type="button"
                className="pointer-events-auto relative z-20 grid size-10 place-items-center rounded-full border border-transparent text-[var(--app-text-secondary)] transition-colors duration-150 ease-out hover:border-[color-mix(in_srgb,var(--app-danger)_22%,var(--app-border))] hover:bg-[color-mix(in_srgb,var(--app-danger)_08%,white)] hover:text-[var(--app-danger)]"
                aria-label={`Hide ${job.title}`}
                title="Hide role"
                onClick={onHide}
                whileTap={reducedMotion ? undefined : { scale: 0.92 }}
              >
                <AppIcon name="trash" className="size-4" />
              </motion.button>
            ) : null}
            {!isPreviewJob(job) ? (
              listingIsExternal ? (
                <motion.a
                  href={listingHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} pointer-events-auto relative z-20`}
                  aria-label={`Open original listing — ${job.title}`}
                  title="Original listing"
                  whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                >
                  <AppIcon name="arrow-up-right" className="size-5" />
                </motion.a>
              ) : (
                <motion.span
                  aria-hidden
                  className={`${linkClass} pointer-events-none`}
                  title="View role in Doubow"
                  whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                >
                  <AppIcon name="arrow-up-right" className="size-5" />
                </motion.span>
              )
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function DiscoveryClient({
  initialFeed,
  initialJobs,
  initialHiddenJobs,
  catalogSummary,
  resumeStatus,
  loadError,
  matchScope = "default",
  remoteOnly = false,
}: {
  initialFeed: FeedRow[];
  initialJobs: JobRow[];
  initialHiddenJobs: JobRow[];
  catalogSummary: CatalogSummary | null;
  resumeStatus?: string | null;
  loadError: boolean;
  /** When ``worldwide``, discovery feed ranks with lower geography weight vs résumé similarity. */
  matchScope?: "default" | "worldwide";
  /** When true, feed only includes listings whose location text suggests remote / anywhere. */
  remoteOnly?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => {
    const fromFeed: DisplayRow[] = initialFeed.map((row) => ({
      job: row.job,
      score: row.score,
      similarity: row.similarity,
      scoreReason: row.score_reason || null,
      components: row.score_components || {},
    }));
    const seen = new Set(fromFeed.map((r) => r.job.id));
    const fromJobsOnly: DisplayRow[] = initialJobs
      .filter((job) => !seen.has(job.id))
      .map((job) => ({
        job,
        score: null,
        similarity: null,
        scoreReason: null,
        components: {},
      }));
    // When the feed is personalized (e.g. résumé similarity), it only includes embedded jobs.
    // Merge the full recent catalog so other providers (Remote OK, Adzuna, etc.) still surface.
    const source = fromFeed.length > 0 ? [...fromFeed, ...fromJobsOnly] : fromJobsOnly;
    return source.map((row) => normalizedRow(row));
  }, [initialFeed, initialJobs]);

  useEffect(() => {
    setVisibleLimit(12);
  }, [query, tab]);

  const favoriteCount = favorites.size;
  const totalCount = catalogSummary?.active_total || initialJobs.length || initialFeed.length;
  const embeddedTotal = catalogSummary?.embedded_total ?? 0;
  const missingEmb = catalogSummary?.missing_embedding_total ?? 0;
  const activeTotal = catalogSummary?.active_total ?? 0;
  const showCatalogHint =
    !loadError &&
    catalogSummary != null &&
    (missingEmb > 0 || (activeTotal > 0 && embeddedTotal < activeTotal));
  const visibleRows = rows.filter(({ job }) => {
    if (hiddenIds.has(job.id)) return false;
    if (tab === "favorites" && !favorites.has(job.id)) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return `${job.title} ${job.company} ${job.location || ""} ${job.tags.join(" ")}`.toLowerCase().includes(needle);
  });
  const displayedRows = visibleRows.slice(0, visibleLimit);

  function toggleFavorite(id: string) {
    const row = rows.find((r) => r.job.id === id);
    const live = row && !isPreviewJob(row.job);
    const nextFavorite = !favorites.has(id);
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (live) {
      startTransition(() => {
        const call = nextFavorite
          ? fetch(`/api/jobs/${encodeURIComponent(id)}/feedback`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "upvote", reason: "saved from discovery" }),
            })
          : fetch(`/api/jobs/${encodeURIComponent(id)}/feedback`, { method: "DELETE" });
        void call.then(() => postJobEvent(id, "save")).catch(() => undefined);
      });
    }
  }

  function hideJob(id: string) {
    const row = rows.find((r) => r.job.id === id);
    setHiddenIds((current) => new Set(current).add(id));
    setFavorites((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (row && !isPreviewJob(row.job)) {
      startTransition(() => {
        void fetch(`/api/jobs/${encodeURIComponent(id)}/feedback`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "hide", reason: "hidden from discovery" }),
        })
          .then(() => postJobEvent(id, "dismiss", "hidden from discovery"))
          .catch(() => undefined);
      });
    }
  }

  return (
    <section className="ch-panel min-h-[calc(100vh-104px)] p-4 sm:p-5">
      {showCatalogHint ? (
        <p className="mb-3 text-[12px] leading-snug text-[var(--app-text-secondary)]">
          {missingEmb > 0 ? (
            <>
              <span className="font-semibold text-[var(--app-text-primary)]">{missingEmb}</span> still embedding — ranking will sharpen
              shortly.
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--app-text-primary)]">{embeddedTotal}</span> /{" "}
              <span className="font-semibold text-[var(--app-text-primary)]">{activeTotal}</span> embedded — others ranked heuristically
              until indexing finishes.
            </>
          )}
        </p>
      ) : null}

      <div className="mb-4 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-2.5 shadow-[var(--app-shadow-0)] sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
          <div className="flex max-w-full min-w-0 rounded-full bg-[var(--app-bg-muted)] p-0.5 sm:max-w-[17rem]">
            <button
              type="button"
              className={`relative z-0 flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors duration-150 ease-out sm:px-3 sm:text-[13px] ${
                tab === "all" ? "text-[var(--app-accent)]" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
              }`}
              onClick={() => setTab("all")}
            >
              {tab === "all" ? (
                <motion.span
                  layoutId="discovery-tab-pill"
                  className="pointer-events-none absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-border)_50%,transparent)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative z-[1] flex items-center justify-center gap-1.5">
                <AppIcon name="briefcase" className="size-3.5 shrink-0" />
                <span>All</span>
                <Tag active={tab === "all"}>{totalCount}</Tag>
              </span>
            </button>
            <button
              type="button"
              className={`relative z-0 flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors duration-150 ease-out sm:px-3 sm:text-[13px] ${
                tab === "favorites"
                  ? "text-[var(--app-accent)]"
                  : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
              }`}
              onClick={() => setTab("favorites")}
            >
              {tab === "favorites" ? (
                <motion.span
                  layoutId="discovery-tab-pill"
                  className="pointer-events-none absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-border)_50%,transparent)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative z-[1] flex items-center justify-center gap-1.5">
                <AppIcon name="star" className="size-3.5 shrink-0" />
                <span>Saved</span>
                <Tag active={tab === "favorites"}>{favoriteCount}</Tag>
              </span>
            </button>
          </div>

          <div className="hidden h-7 w-px shrink-0 bg-[var(--app-border)] sm:block" aria-hidden />

          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5"
            title="Reloads ranked results from the API. Balanced weighs location; Worldwide stresses CV fit."
          >
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-tertiary)]">Location</span>
            <div
              className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--app-border)_85%,transparent)] bg-[var(--app-bg-muted)] p-0.5"
              role="group"
              aria-label="Location emphasis"
            >
              <Link
                href={discoveryPrefsHref("default", remoteOnly)}
                scroll={false}
                className={`flex min-h-8 items-center justify-center rounded-full px-2.5 text-[12px] font-semibold transition-colors sm:px-3 ${
                  matchScope === "default"
                    ? "bg-white text-[var(--app-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-border)_45%,transparent)]"
                    : "text-[var(--app-text-primary)] hover:bg-white/80"
                }`}
              >
                Balanced
              </Link>
              <Link
                href={discoveryPrefsHref("worldwide", remoteOnly)}
                scroll={false}
                className={`flex min-h-8 items-center justify-center rounded-full px-2.5 text-[12px] font-semibold transition-colors sm:px-3 ${
                  matchScope === "worldwide"
                    ? "bg-white text-[var(--app-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-border)_45%,transparent)]"
                    : "text-[var(--app-text-primary)] hover:bg-white/80"
                }`}
              >
                Worldwide
              </Link>
            </div>
          </div>

          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5"
            title="Remote only filters the server feed to remote-style listings."
          >
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-tertiary)]">Format</span>
            <div
              className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--app-border)_85%,transparent)] bg-[var(--app-bg-muted)] p-0.5"
              role="group"
              aria-label="Work format"
            >
              <Link
                href={discoveryPrefsHref(matchScope, false)}
                scroll={false}
                className={`flex min-h-8 items-center justify-center rounded-full px-2.5 text-[12px] font-semibold transition-colors sm:px-3 ${
                  !remoteOnly
                    ? "bg-white text-[var(--app-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-border)_45%,transparent)]"
                    : "text-[var(--app-text-primary)] hover:bg-white/80"
                }`}
              >
                All
              </Link>
              <Link
                href={discoveryPrefsHref(matchScope, true)}
                scroll={false}
                className={`flex min-h-8 items-center justify-center rounded-full px-2.5 text-[12px] font-semibold transition-colors sm:px-3 ${
                  remoteOnly
                    ? "bg-white text-[var(--app-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-accent)_25%,var(--app-border))]"
                    : "text-[var(--app-text-primary)] hover:bg-white/80"
                }`}
              >
                Remote
              </Link>
            </div>
          </div>
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[color-mix(in_srgb,var(--app-border)_70%,transparent)] pt-2"
          title="Search filters cards already on this page."
        >
          <ToolbarButton label="Filters" icon="filter" />
          <ToolbarButton label="Sort" icon="analytics" />
          <label className="group flex h-9 min-w-0 flex-1 basis-[10rem] items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-2.5 text-[13px] shadow-sm transition-[box-shadow,border-color] duration-150 focus-within:border-[color-mix(in_srgb,var(--app-accent)_40%,var(--app-border))] sm:max-w-[13rem] sm:flex-none">
            <AppIcon
              name="search"
              className="size-4 shrink-0 text-[var(--app-text-secondary)] group-focus-within:text-[var(--app-accent)]"
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none placeholder:text-[var(--app-text-tertiary)]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter…"
              aria-label="Filter loaded roles by keyword"
            />
          </label>
        </div>
      </div>

      <div className="my-5 border-t border-[var(--app-border)]" />

      {catalogSummary && showCatalogSourceDebugUi() ? <DiscoveryCatalogSourceDebug summary={catalogSummary} /> : null}

      {!loadError ? (
        <DiscoveryScoringExplainer resumeStatus={resumeStatus} catalogSummary={catalogSummary} />
      ) : null}

      {loadError ? (
        <div className="mb-5 rounded-2xl border border-[color-mix(in_srgb,var(--app-danger)_25%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_7%,white)] px-5 py-4 text-[14px] text-[var(--app-danger)]">
          Could not load live jobs. Try again in a moment, or check back after your ingest pipeline runs.
        </div>
      ) : null}

      {tab === "favorites" && visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-white px-5 py-16 text-center text-[var(--app-text-secondary)]">
          No favorites yet. Star a role to add it here.
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-white px-5 py-16 text-center text-[var(--app-text-secondary)]">
          {query.trim()
            ? "No matching roles found."
            : "No live roles are available yet. Run a provider sync to populate Discovery."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayedRows.map((row, index) => (
            <DiscoveryCard
              key={row.job.id}
              row={row}
              index={index}
              favorite={favorites.has(row.job.id)}
              onToggleFavorite={() => toggleFavorite(row.job.id)}
              onHide={() => hideJob(row.job.id)}
            />
          ))}
        </div>
      )}

      {displayedRows.length < visibleRows.length ? (
        <div className="mt-8 flex justify-center">
          <ChromePrimaryButton
            className="min-w-44 gap-2"
            type="button"
            onClick={() => setVisibleLimit((current) => current + 12)}
          >
            <AppIcon name="chevron-down" className="size-5 opacity-90" />
            Show more roles
          </ChromePrimaryButton>
        </div>
      ) : null}

      {initialHiddenJobs.length ? (
        <p className="mt-6 text-[12px] text-[var(--app-text-tertiary)]">
          {initialHiddenJobs.length} hidden roles are excluded from this view.
        </p>
      ) : null}
    </section>
  );
}
