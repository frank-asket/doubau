"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { JobPipelineHint } from "@/components/app/JobPipelineHint";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";

import type { JobRow } from "./DiscoveryClient";
import { JobCompanyMark } from "@/components/discovery/JobCompanyMark";

type FitScoreResponse = {
  score: number;
  match_pct: number;
  rationale: string;
  gap_skills: string[];
  strength_skills: string[];
};

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

function fitBarClass(score: number): { bar: string; text: string; label: string } {
  if (score >= 80) {
    return {
      bar: "bg-[#639922]",
      text: "text-[#27500A]",
      label: "Strong match",
    };
  }
  if (score >= 50) {
    return {
      bar: "bg-[var(--app-accent)]",
      text: "text-[#0C447C]",
      label: "Moderate match",
    };
  }
  return {
    bar: "bg-[#BA7517]",
    text: "text-[#633806]",
    label: "Stretch role",
  };
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--app-text-tertiary)]">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-[var(--app-text-primary)]">{value}</div>
    </div>
  );
}

export function JobDetailClient({ job }: { job: JobRow }) {
  const router = useRouter();
  const [fit, setFit] = useState<FitScoreResponse | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [fitError, setFitError] = useState<string | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachMsg, setOutreachMsg] = useState<string | null>(null);

  const loadFit = useCallback(async () => {
    setFitLoading(true);
    setFitError(null);
    try {
      const r = await fetch(`/api/jobs/${job.id}/fit`, { method: "POST" });
      const data = (await r.json().catch(() => ({}))) as FitScoreResponse & { detail?: string };
      if (!r.ok) {
        setFitError(typeof data.detail === "string" ? data.detail : `Fit failed (${r.status})`);
        setFit(null);
        return;
      }
      setFit(data as FitScoreResponse);
    } finally {
      setFitLoading(false);
    }
  }, [job.id]);

  const generateOutreach = useCallback(async () => {
    setOutreachBusy(true);
    setOutreachMsg(null);
    try {
      const cr = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: job.company,
          job_title: job.title,
          source_url: job.source_url ?? undefined,
        }),
      });
      const appBody = (await cr.json().catch(() => ({}))) as { id?: string; detail?: string };
      if (!cr.ok) {
        setOutreachMsg(typeof appBody.detail === "string" ? appBody.detail : `Could not create application (${cr.status})`);
        return;
      }
      const appId = appBody.id;
      if (!appId) {
        setOutreachMsg("Unexpected response from server.");
        return;
      }
      const dr = await fetch(`/api/applications/${appId}/generate_draft`, { method: "POST" });
      if (!dr.ok) {
        const d = (await dr.json().catch(() => ({}))) as { detail?: string };
        setOutreachMsg(typeof d.detail === "string" ? d.detail : "Draft generation failed.");
        return;
      }
      router.push("/app/approvals");
    } finally {
      setOutreachBusy(false);
    }
  }, [job.company, job.title, job.source_url, router]);

  const scoreDisplay = fit ? Math.round(fit.score) : null;
  const fitStyle = scoreDisplay != null ? fitBarClass(scoreDisplay) : null;

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/discovery"
            className="inline-flex items-center gap-1 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text-primary)] active:scale-[0.96]"
          >
            <AppIcon name="chevron-right" className="size-4 rotate-180" /> Back to discovery
          </Link>
          <Link
            href="/app/approvals"
            className="inline-flex items-center gap-1 rounded-[var(--app-radius-md)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] active:scale-[0.96]"
          >
            Approvals queue <AppIcon name="chevron-right" className="size-4" />
          </Link>
        </div>
        <div className="min-w-0 sm:max-w-[min(100%,420px)] sm:shrink">
          <JobPipelineHint variant="job" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(220px,280px)]">
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--app-border)] pb-5">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <JobCompanyMark company={job.company} sourceUrl={job.source_url} size="detail" />
              <div className="min-w-0">
                <h1 className="text-pretty text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
                  {job.title}
                </h1>
                <p className="mt-1 text-[15px] font-medium text-[var(--app-accent)]">{job.company}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.tags?.slice(0, 8).map((t) => (
                    <AppBadge key={t} variant="blue">
                      {t}
                    </AppBadge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {job.source_url ? (
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--app-accent-hover)] active:scale-[0.96]"
                >
                  View original
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <section>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                Job description
              </h2>
              {job.description?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--app-text-secondary)]">
                  {job.description.trim()}
                </p>
              ) : (
                <div className="mt-2 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] px-4 py-3 text-pretty text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
                  No full description stored here.{" "}
                  {job.source_url ? (
                    <a href={job.source_url} target="_blank" rel="noreferrer" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                      Open the original posting
                    </a>
                  ) : (
                    "Add a source URL when importing listings to link out."
                  )}
                </div>
              )}
            </section>

            {job.tags && job.tags.length > 0 ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Skills & tags
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex rounded-[var(--app-radius-pill)] bg-[var(--app-badge-blue-bg)] px-2.5 py-0.5 text-[12px] font-medium text-[#0C447C]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-4 text-[12px] text-[var(--app-text-tertiary)]">
              {listingSourceLabel(job.listing_source) ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--app-radius-pill)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-2.5 py-1">
                  via {listingSourceLabel(job.listing_source)}
                </span>
              ) : null}
              {formatListedAt(job.source_posted_at ?? job.created_at) ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--app-radius-pill)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-2.5 py-1">
                  Posted {formatListedAt(job.source_posted_at ?? job.created_at)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
            <div className="space-y-4">
              <MetaItem label="Date posted" value={formatListedAt(job.source_posted_at ?? job.created_at) ?? "—"} />
              <MetaItem label="Provider" value={listingSourceLabel(job.listing_source) ?? "—"} />
              <MetaItem
                label="Employment type"
                value={job.employment_type?.replace(/_/g, " ") || "—"}
              />
              <MetaItem label="Seniority" value={job.seniority || "—"} />
              <MetaItem label="Location" value={job.location || "—"} />
              <MetaItem label="Work arrangement" value={job.location?.toLowerCase().includes("remote") ? "Remote-friendly" : "See listing"} />
            </div>
          </div>

          <AppButton
            type="button"
            variant="primary"
            className="w-full justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-transform active:scale-[0.96] disabled:active:scale-100"
            disabled={outreachBusy}
            aria-busy={outreachBusy}
            onClick={() => void generateOutreach()}
          >
            {outreachBusy ? "Working…" : "Generate outreach"}
          </AppButton>
          {outreachMsg ? (
            <p className="text-center text-[12px] text-[var(--app-badge-red-fg)]" role="alert">
              {outreachMsg}
            </p>
          ) : (
            <p className="text-center text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
              Creates an application draft, then opens your review queue. Nothing is sent until you approve.
            </p>
          )}

          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
            <div className="text-[12px] font-semibold text-[var(--app-text-primary)]">Fit score</div>
            {!fit && !fitLoading ? (
              <div className="mt-3">
                <p className="text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
                  Compare this role to your latest parsed résumé with the same structured model as discovery.
                </p>
                <AppButton
                  type="button"
                  variant="outline"
                  className="mt-3 w-full justify-center transition-transform active:scale-[0.96]"
                  onClick={() => void loadFit()}
                >
                  Check fit
                </AppButton>
                {fitError ? (
                  <p className="mt-2 text-[12px] text-[var(--app-badge-red-fg)]">{fitError}</p>
                ) : null}
              </div>
            ) : null}
            {fitLoading ? (
              <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                <div className="h-7 w-[40%] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
                <div className="h-2 w-full animate-pulse rounded-full bg-[var(--app-bg-muted)]" />
                <div className="h-3 w-[85%] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
                <div className="h-3 w-[60%] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
                <p className="pt-1 text-[12px] text-[var(--app-text-tertiary)]">Scoring against your résumé…</p>
              </div>
            ) : null}
            {fit && fitStyle ? (
              <div className="mt-3">
                <div className={`text-[22px] font-semibold tabular-nums ${fitStyle.text}`}>{Math.round(fit.score)}%</div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
                  <div className={`h-full rounded-full ${fitStyle.bar}`} style={{ width: `${Math.min(100, Math.round(fit.score))}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
                  {fitStyle.label}
                  {fit.gap_skills?.length ? ` · ${fit.gap_skills.length} skill gap(s)` : ""}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{fit.rationale}</p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
