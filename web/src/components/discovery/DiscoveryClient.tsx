"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Tag } from "@/components/workspace/CareerHeroMockSections";

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
type ImportKind = "url" | "rss";

type DisplayRow = {
  job: JobRow;
  score: number | null;
  similarity: number | null;
  scoreReason: string | null;
  components: Record<string, number>;
};

const MOCK_JOBS: JobRow[] = [
  {
    id: "meta",
    company: "Meta Platform, Inc",
    title: "Project Manager",
    location: "Office",
    seniority: "3 year exp",
    employment_type: "Full time",
    description:
      "Meta, one of the world's leading technology companies, is placing a renewed emphasis on building meaningful digital interactions across...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "google",
    company: "Google LLC",
    title: "Project Manager",
    location: "Remote",
    seniority: "8 year exp",
    employment_type: "Full time",
    description:
      "Google continues to transform the way billions of people search, work, and connect by investing heavily in AI, cloud infrastructure, and product...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "amazon",
    company: "Amazon.com, Inc",
    title: "Project Manager",
    location: "Office",
    seniority: "4 year exp",
    employment_type: "Part time",
    description:
      "Amazon, the global e-commerce leader, is doubling down on elevating its end-to-end customer journey. With millions of daily users. As a Project...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "zalando",
    company: "Zalando, SE",
    title: "Project Manager",
    location: "Remote",
    seniority: "10 year exp",
    employment_type: "Full time",
    description:
      "Zalando, one of Europe's top online fashion retailers, is investing in smarter recommendations, better logistics visibility, and enhanced mobile shopping...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "glovo",
    company: "Glovo",
    title: "Project Manager",
    location: "Office",
    seniority: "3 year exp",
    employment_type: "Full time",
    description:
      "Glovo, a widely used delivery platform across Europe, is focusing on optimizing courier routing, accelerating restaurant onboarding, and...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "revolut",
    company: "Revolut",
    title: "Project Manager",
    location: "Office",
    seniority: "2 year exp",
    employment_type: "Full time",
    description:
      "Revolut, a fast-scaling fintech company, is prioritizing seamless onboarding, improved financial tools, and stronger customer protection. Work as...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "airbnb",
    company: "Airbnb, Inc.",
    title: "Project Manager",
    location: "Office",
    seniority: "4 year exp",
    employment_type: "Full time",
    description:
      "Airbnb continues to evolve its platform to support safer stays, smoother onboarding for hosts, and better booking transparency for guests. As a...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "shopify",
    company: "Shopify, Inc",
    title: "Project Manager",
    location: "Office",
    seniority: "6 year exp",
    employment_type: "Part time",
    description:
      "Shopify, powering millions of online stores, has renewed its focus on merchant experience, checkout performance, and streamlined store...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
  {
    id: "netflix",
    company: "Netflix, Inc",
    title: "Project Manager",
    location: "Remote",
    seniority: "2 year exp",
    employment_type: "Full time",
    description:
      "Netflix, the global leader in streaming entertainment, is intensifying its focus on platform personalization, content discovery, and platform...",
    tags: [],
    source_url: "#",
    created_at: new Date().toISOString(),
  },
];

const LOGOS: Record<string, { text: string; bg: string; fg: string }> = {
  meta: { text: "∞", bg: "#2f80ed", fg: "white" },
  google: { text: "G", bg: "#ffffff", fg: "#4285f4" },
  amazon: { text: "a", bg: "#ffffff", fg: "#111111" },
  zalando: { text: "▶", bg: "#ff6422", fg: "white" },
  glovo: { text: "⌖", bg: "#f2c94c", fg: "#35966c" },
  revolut: { text: "R", bg: "#ffffff", fg: "#111111" },
  airbnb: { text: "A", bg: "#ff5a70", fg: "white" },
  shopify: { text: "S", bg: "#eef7e8", fg: "#75b84a" },
  netflix: { text: "N", bg: "#111111", fg: "#e50914" },
};

function keyForCompany(company: string) {
  const c = company.toLowerCase();
  if (c.includes("meta")) return "meta";
  if (c.includes("google")) return "google";
  if (c.includes("amazon")) return "amazon";
  if (c.includes("zalando")) return "zalando";
  if (c.includes("glovo")) return "glovo";
  if (c.includes("revolut")) return "revolut";
  if (c.includes("airbnb")) return "airbnb";
  if (c.includes("shopify")) return "shopify";
  if (c.includes("netflix")) return "netflix";
  return "google";
}

function salaryFor(job: JobRow, index: number) {
  const highPayCompanies = /amazon|apple|senior|lead/i;
  return highPayCompanies.test(`${job.company} ${job.title}`) || index === 2 ? "£75,000" : "£50,000";
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

function normalizedJob(job: JobRow, index: number): JobRow {
  return {
    ...job,
    title: job.title || "Project Manager",
    company: job.company || MOCK_JOBS[index % MOCK_JOBS.length].company,
    seniority: job.seniority || MOCK_JOBS[index % MOCK_JOBS.length].seniority,
    employment_type: job.employment_type || MOCK_JOBS[index % MOCK_JOBS.length].employment_type,
    location: job.location || MOCK_JOBS[index % MOCK_JOBS.length].location,
    description: job.description || MOCK_JOBS[index % MOCK_JOBS.length].description,
  };
}

function normalizedRow(row: DisplayRow, index: number): DisplayRow {
  return {
    ...row,
    job: normalizedJob(row.job, index),
  };
}

function isPreviewJob(job: JobRow) {
  return MOCK_JOBS.some((j) => j.id === job.id) || job.id.startsWith("mock-");
}

function sourceLabel(job: JobRow) {
  if (job.listing_source === "remoteok") return "RemoteOK";
  if (job.listing_source === "adzuna") return "Adzuna";
  if (job.listing_source === "http_fetch") return "Imported";
  if (job.listing_source) return job.listing_source;
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

function ToolbarButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button className="ch-icon-button" type="button" aria-label={label} title={label}>
      {children}
    </button>
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
  const job = row.job;
  const key = keyForCompany(job.company);
  const logo = LOGOS[key];
  const tags = [
    job.seniority || "3 year exp",
    job.employment_type || "Full time",
    job.location || "Office",
  ];
  const detailHref = isPreviewJob(job) ? "#" : `/app/discovery/${job.id}`;
  const description = job.description || "";
  const hasLiveUrl = Boolean(job.source_url && job.source_url !== "#");
  const score = typeof row.score === "number" ? Math.round(row.score) : null;
  const components = Object.entries(row.components || {}).slice(0, 3);

  return (
    <motion.article
      className="group relative overflow-hidden rounded-[26px] border border-[color-mix(in_srgb,var(--app-border)_70%,transparent)] bg-[rgba(255,255,255,0.86)] shadow-[0_20px_48px_rgba(9,28,17,0.07)] backdrop-blur transition hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--app-accent)_38%,var(--app-border))] hover:shadow-[0_28px_70px_rgba(9,28,17,0.13)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.035, 0.25) }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--app-accent)] via-[#348ef6] to-[#ffb454] opacity-80" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="grid size-14 shrink-0 place-items-center rounded-2xl text-[28px] font-black shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06),0_14px_28px_rgba(9,28,17,0.08)]"
              style={{ backgroundColor: logo.bg, color: logo.fg }}
            >
              {logo.text}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold tracking-[-0.01em] text-[var(--app-text-primary)]">
                {job.title}
              </h2>
              <p className="mt-1 truncate text-[15px] font-semibold text-[var(--app-accent)]">
                {job.company}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`text-[26px] leading-none ${favorite ? "text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            onClick={onToggleFavorite}
          >
            {favorite ? "★" : "☆"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          <Tag>{sourceLabel(job)}</Tag>
          {score !== null ? <Tag active>{score}% match</Tag> : null}
          <Tag>{postedLabel(job)}</Tag>
        </div>

        <p className="mt-6 line-clamp-3 min-h-[78px] text-[15px] leading-[1.55] text-[var(--app-text-primary)]">
          {description}
        </p>

        {row.scoreReason ? (
          <p className="mt-4 line-clamp-1 text-[13px] font-semibold text-[var(--app-text-secondary)]">
            {row.scoreReason}
          </p>
        ) : null}

        {components.length ? (
          <div className="mt-5 grid gap-2">
            {components.map(([name, value]) => (
              <div key={name} className="grid grid-cols-[92px_1fr_42px] items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
                <span>{name}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
                  <span
                    className="block h-full rounded-full bg-[var(--app-accent)]"
                    style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{Math.round(value)}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-[var(--app-border)] px-6 py-5">
        <p className="text-[22px] font-black tracking-[-0.03em] text-[var(--app-text-primary)]">
          {salaryFor(job, index)} <span className="text-[13px] font-semibold text-[var(--app-text-secondary)]">/year</span>
        </p>
        <div className="flex items-center gap-3">
          {!isPreviewJob(job) ? (
            <button
              type="button"
              className="text-[18px] text-[var(--app-text-secondary)] transition hover:text-[var(--app-danger)]"
              aria-label={`Hide ${job.title}`}
              title="Hide role"
              onClick={onHide}
            >
              ×
            </button>
          ) : null}
          {hasLiveUrl ? (
            <a
              href={job.source_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="text-[24px] text-[var(--app-text-secondary)] transition group-hover:text-[var(--app-accent)]"
              aria-label={`Open ${job.title} source`}
              onClick={() => void postJobEvent(job.id, "click_out")}
            >
              ↗
            </a>
          ) : (
            <Link
              href={detailHref}
              className="text-[24px] text-[var(--app-text-secondary)] transition group-hover:text-[var(--app-accent)]"
              aria-label={`Open ${job.title}`}
              onClick={() => void postJobEvent(job.id, "click_out")}
            >
              ↗
            </Link>
          )}
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
  loadError,
}: {
  initialFeed: FeedRow[];
  initialJobs: JobRow[];
  initialHiddenJobs: JobRow[];
  catalogSummary: CatalogSummary | null;
  loadError: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(initialFeed.length || initialJobs.length ? [] : ["google", "glovo", "shopify"]),
  );
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [openToWork, setOpenToWork] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importKind, setImportKind] = useState<ImportKind>("url");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const source: DisplayRow[] = initialFeed.length
      ? initialFeed.map((row) => ({
          job: row.job,
          score: row.score,
          similarity: row.similarity,
          scoreReason: row.score_reason || null,
          components: row.score_components || {},
        }))
      : initialJobs.length
        ? initialJobs.map((job) => ({
            job,
            score: null,
            similarity: null,
            scoreReason: null,
            components: {},
          }))
        : MOCK_JOBS.map((job) => ({
            job,
            score: null,
            similarity: null,
            scoreReason: null,
            components: {},
          }));
    return source.slice(0, 12).map((row, index) => normalizedRow(row, index));
  }, [initialFeed, initialJobs]);

  const favoriteCount = favorites.size;
  const totalCount = catalogSummary?.active_total || initialJobs.length || initialFeed.length || 108;
  const visibleRows = rows.filter(({ job }) => {
    if (hiddenIds.has(job.id)) return false;
    if (tab === "favorites" && !favorites.has(job.id)) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return `${job.title} ${job.company} ${job.location || ""} ${job.tags.join(" ")}`.toLowerCase().includes(needle);
  });

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

  function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = importUrl.trim();
    if (!url) return;
    setImportStatus("Queueing import...");
    startTransition(() => {
      void fetch("/api/jobs/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, kind: importKind }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Import failed");
          setImportStatus("Import queued. New roles appear after the worker finishes.");
          setImportUrl("");
        })
        .catch(() => setImportStatus("Could not queue that import."));
    });
  }

  return (
    <section className="ch-panel min-h-[calc(100vh-104px)] p-6">
      <div className="doubow-orb mb-6 overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-border))] bg-[#07110d] p-7 text-white shadow-[0_28px_70px_rgba(9,28,17,0.18)]">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--app-accent)]">
              Curated role network
            </p>
            <h2 className="mt-3 text-[32px] font-black leading-[1.02] tracking-[-0.045em] md:text-[44px]">
              High-signal opportunities, ranked for your next move.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/68">
              Doubow blends resume embeddings, seniority fit, freshness, and location signals so the page feels more like a talent marketplace than a scraped job board.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/48">Active roles</span>
              <strong className="mt-2 block text-[30px] font-black tracking-[-0.04em]">{totalCount}</strong>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/48">Embedded</span>
              <strong className="mt-2 block text-[30px] font-black tracking-[-0.04em]">{catalogSummary?.embedded_total ?? initialFeed.length}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full max-w-xl rounded-full bg-[var(--app-bg-muted)] p-1">
          <button
            type="button"
            className={`flex min-h-12 flex-1 items-center justify-center gap-3 rounded-full px-5 text-[15px] font-semibold transition ${
              tab === "all" ? "bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-1)]" : "text-[var(--app-text-secondary)]"
            }`}
            onClick={() => setTab("all")}
          >
            <span aria-hidden>▣</span> All Jobs <Tag active>{totalCount}</Tag>
          </button>
          <button
            type="button"
            className={`flex min-h-12 flex-1 items-center justify-center gap-3 rounded-full px-5 text-[15px] font-semibold transition ${
              tab === "favorites" ? "bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-1)]" : "text-[var(--app-text-secondary)]"
            }`}
            onClick={() => setTab("favorites")}
          >
            <span aria-hidden>★</span> Favorites Jobs <Tag>{favoriteCount}</Tag>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ToolbarButton label="Filters">☷</ToolbarButton>
          <ToolbarButton label="Sort">⇅</ToolbarButton>
          <label className="flex min-h-12 w-52 items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-4 text-[14px] shadow-[var(--app-shadow-1)]">
            <span aria-hidden className="text-[var(--app-text-secondary)]">O</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder:text-[var(--app-text-tertiary)]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter roles"
            />
          </label>
          <button
            className={`ch-primary-button min-w-44 ${openToWork ? "bg-[var(--app-success)]" : ""}`}
            type="button"
            onClick={() => setOpenToWork((value) => !value)}
          >
            <span aria-hidden>⊙</span> Open to Work
          </button>
          <button className="ch-primary-button min-w-44" type="button" onClick={() => setShowImport((value) => !value)}>
            <span aria-hidden className="text-[22px]">+</span> Add Job
          </button>
        </div>
      </div>

      {showImport ? (
        <form
          className="mt-5 grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-white p-4 shadow-[var(--app-shadow-1)] lg:grid-cols-[auto_1fr_auto]"
          onSubmit={submitImport}
        >
          <select
            className="min-h-12 rounded-full border border-[var(--app-border)] bg-white px-4 text-[14px] font-semibold outline-none"
            value={importKind}
            onChange={(event) => setImportKind(event.target.value as ImportKind)}
            aria-label="Import type"
          >
            <option value="url">Job URL</option>
            <option value="rss">RSS Feed</option>
          </select>
          <input
            className="min-h-12 rounded-full border border-[var(--app-border)] bg-white px-5 text-[14px] font-semibold outline-none placeholder:text-[var(--app-text-tertiary)]"
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://company.com/jobs/product-manager"
          />
          <button className="ch-primary-button min-w-36" type="submit" disabled={isPending}>
            {isPending ? "Queueing" : "Import"}
          </button>
          {importStatus ? (
            <p className="text-[13px] font-semibold text-[var(--app-text-secondary)] lg:col-span-3">
              {importStatus}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="my-8 border-t border-[var(--app-border)]" />

      {loadError ? (
        <div className="mb-5 rounded-2xl border border-[color-mix(in_srgb,var(--app-danger)_25%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_7%,white)] px-5 py-4 text-[14px] text-[var(--app-danger)]">
          Could not load live jobs, so preview roles are shown.
        </div>
      ) : null}

      {tab === "favorites" && visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-white px-5 py-16 text-center text-[var(--app-text-secondary)]">
          No favorites yet. Star a role to add it here.
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-white px-5 py-16 text-center text-[var(--app-text-secondary)]">
          No matching roles found.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleRows.map((row, index) => (
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

      {initialHiddenJobs.length ? (
        <p className="mt-6 text-[12px] text-[var(--app-text-tertiary)]">
          {initialHiddenJobs.length} hidden roles are excluded from this mockup-style view.
        </p>
      ) : null}
    </section>
  );
}
