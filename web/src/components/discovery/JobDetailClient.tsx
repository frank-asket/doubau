"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import { JobPipelineHint } from "@/components/app/JobPipelineHint";
import { JobCompanyMark, hostnameFromSourceUrl, resolveCompanyLogoHost } from "@/components/discovery/JobCompanyMark";
import type { JobRow } from "@/components/discovery/DiscoveryClient";
import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import { ChromeIconButton, ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { parseJobDescriptionSections } from "@/lib/job-detail-parse";
import { cn } from "@/lib/utils";

type FitScoreResponse = {
  score: number;
  match_pct: number;
  rationale: string;
  gap_skills: string[];
  strength_skills: string[];
};

function isPreviewJob(job: JobRow): boolean {
  return job.id.startsWith("mock-");
}

async function postJobEvent(
  jobId: string,
  eventType: "impression" | "click_out" | "apply_click" | "dismiss" | "save",
  reason?: string,
) {
  if (!jobId || isPreviewJob({ id: jobId } as JobRow)) return;
  await fetch(`/api/jobs/${encodeURIComponent(jobId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_type: eventType, reason }),
  }).catch(() => undefined);
}

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

function formatDateLong(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function formatEmployment(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  return raw.replace(/_/g, " ");
}

function workArrangementLabel(job: JobRow): string {
  const loc = (job.location || "").toLowerCase();
  if (/\bhybrid\b/.test(loc)) return "Hybrid";
  if (/\bremote\b/.test(loc) || /\banywhere\b/.test(loc)) return "Remote";
  if (loc.trim()) return "Office";
  return "See listing";
}

function extractSalaryHint(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = description.match(
    /(?:£|€|\$|GBP|EUR|USD)\s*[\d,.]+(?:\s*[-–]\s*[\d,.]+)?|[\d,.]+\s*[-–]\s*[\d,.]+\s*(?:£|€|\$|GBP|EUR|USD)/i,
  );
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}

function fitBarClass(score: number): { bar: string; text: string; label: string } {
  if (score >= 80) {
    return { bar: "bg-[#639922]", text: "text-[#27500A]", label: "Strong match" };
  }
  if (score >= 50) {
    return { bar: "bg-[var(--app-accent)]", text: "text-[#0C447C]", label: "Moderate match" };
  }
  return { bar: "bg-[#BA7517]", text: "text-[#633806]", label: "Stretch role" };
}

function SidebarInfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-[var(--app-text-tertiary)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--app-text-tertiary)]">{label}</div>
        <div className="mt-0.5 text-[13px] font-medium leading-snug text-[var(--app-text-primary)]">{value}</div>
      </div>
    </div>
  );
}

export function JobDetailClient({ job }: { job: JobRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [favorited, setFavorited] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const [fit, setFit] = useState<FitScoreResponse | null>(null);
  const [fitLoading, setFitLoading] = useState(() => !isPreviewJob(job));
  const [fitError, setFitError] = useState<string | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachMsg, setOutreachMsg] = useState<string | null>(null);

  const { overview, responsibilities, requirements } = useMemo(
    () => parseJobDescriptionSections(job.description),
    [job.description],
  );

  const benefitTags = useMemo(() => {
    return job.tags.filter((t) =>
      /bonus|commission|parking|health|dental|insurance|equity|401k|pension|gym|holiday|pto|parental|snack|lunch|stipend|wellness/i.test(
        t,
      ),
    );
  }, [job.tags]);
  const skillTags = useMemo(() => job.tags.filter((t) => !benefitTags.includes(t)), [job.tags, benefitTags]);

  const companySiteHost = useMemo(() => {
    return hostnameFromSourceUrl(job.source_url) ?? resolveCompanyLogoHost(job.company, job.source_url);
  }, [job.company, job.source_url]);

  const salaryLine = extractSalaryHint(job.description);
  const posted = formatDateLong(job.source_posted_at ?? job.created_at);

  const loadFit = useCallback(async () => {
    setFitLoading(true);
    setFitError(null);
    setFit(null);
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

  useEffect(() => {
    if (job.id.startsWith("mock-")) {
      setFit(null);
      setFitError(null);
      setFitLoading(false);
      return;
    }
    void loadFit();
  }, [job.id, loadFit]);

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

  function toggleFavorite() {
    const next = !favorited;
    setFavorited(next);
    if (isPreviewJob(job)) return;
    startTransition(() => {
      const call = next
        ? fetch(`/api/jobs/${encodeURIComponent(job.id)}/feedback`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "upvote", reason: "saved from job detail" }),
          })
        : fetch(`/api/jobs/${encodeURIComponent(job.id)}/feedback`, { method: "DELETE" });
      void call.then(() => postJobEvent(job.id, "save")).catch(() => undefined);
    });
  }

  async function shareListing() {
    setShareHint(null);
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `${job.title} · ${job.company}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareHint("Link copied");
      window.setTimeout(() => setShareHint(null), 2500);
    } catch {
      setShareHint("Could not share");
      window.setTimeout(() => setShareHint(null), 2500);
    }
  }

  const scoreDisplay = fit ? Math.round(fit.score) : null;
  const matchDisplay = fit ? Math.round(fit.match_pct) : null;
  const fitStyle = scoreDisplay != null ? fitBarClass(scoreDisplay) : null;

  const salaryDisplay = salaryLine ? `${salaryLine} (from description)` : "—";

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

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] shadow-[var(--app-shadow-1)]">
          <div className="border-b border-[var(--app-border)] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 gap-4">
                <JobCompanyMark company={job.company} sourceUrl={job.source_url} size="hero" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-pretty text-[clamp(1.35rem,2.6vw,1.85rem)] font-semibold tracking-tight text-[var(--app-text-primary)]">
                    {job.title}
                  </h1>
                  <p className="mt-1 text-[15px] font-medium text-[var(--app-accent)]">{job.company}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {job.source_url ? (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "ch-primary-button fm-motion inline-flex min-h-[40px] min-w-[7.5rem] items-center justify-center rounded-[var(--app-radius-pill)] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.96]",
                    )}
                    onClick={() => void postJobEvent(job.id, "apply_click")}
                  >
                    Apply now
                  </a>
                ) : (
                  <span className="rounded-[var(--app-radius-pill)] border border-dashed border-[var(--app-border)] px-4 py-2 text-[12px] text-[var(--app-text-tertiary)]">
                    No apply URL
                  </span>
                )}
                <ChromeIconButton
                  type="button"
                  aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                  title={favorited ? "Remove from favorites" : "Save to favorites"}
                  disabled={isPending}
                  className={cn(favorited && "text-[var(--app-accent)]")}
                  onClick={toggleFavorite}
                >
                  <AppIcon name={favorited ? "star-filled" : "star"} filled={favorited} className="size-5" />
                </ChromeIconButton>
                <ChromeIconButton type="button" aria-label="Share" title="Share" onClick={() => void shareListing()}>
                  <AppIcon name="share" className="size-5" />
                </ChromeIconButton>
              </div>
            </div>
            {shareHint ? <p className="mt-3 text-center text-[12px] text-[var(--app-text-secondary)] sm:text-right">{shareHint}</p> : null}
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            {overview ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Overview
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--app-text-secondary)]">{overview}</p>
              </section>
            ) : job.description?.trim() ? null : (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Overview
                </h2>
                <div className="mt-3 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] px-4 py-3 text-pretty text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
                  No full description stored here.{" "}
                  {job.source_url ? (
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline"
                    >
                      Open the original posting
                    </a>
                  ) : (
                    "Add a source URL when importing listings to link out."
                  )}
                </div>
              </section>
            )}

            {responsibilities.length > 0 ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Responsibilities
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--app-text-secondary)]">
                  {responsibilities.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {requirements.length > 0 ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Requirements
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--app-text-secondary)]">
                  {requirements.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {!overview && job.description?.trim() ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Job description
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--app-text-secondary)]">
                  {job.description.trim()}
                </p>
              </section>
            ) : null}

            {skillTags.length > 0 ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skillTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-[var(--app-radius-pill)] bg-[var(--app-bg-muted)] px-3 py-1 text-[12px] font-medium text-[var(--app-text-secondary)] ring-1 ring-[color-mix(in_srgb,var(--app-border)_70%,transparent)]"
                    >
                      <AppIcon name="file-text" className="size-3.5 text-[var(--app-text-tertiary)]" />
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {benefitTags.length > 0 ? (
              <section>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Benefits</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {benefitTags.map((t) => (
                    <AppBadge key={t} variant="blue">
                      {t}
                    </AppBadge>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-5 text-[12px] text-[var(--app-text-tertiary)]">
              {listingSourceLabel(job.listing_source) ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--app-radius-pill)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-2.5 py-1">
                  via {listingSourceLabel(job.listing_source)}
                </span>
              ) : null}
              {posted ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--app-radius-pill)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-2.5 py-1">
                  Posted {posted}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 shadow-[var(--app-shadow-1)]">
            <div className="mb-4 text-[13px] font-semibold text-[var(--app-text-primary)]">Job info</div>
            <div className="space-y-4">
              <SidebarInfoRow
                icon={<AppIcon name="calendar" className="size-[18px]" />}
                label="Date posted"
                value={posted ?? "—"}
              />
              <SidebarInfoRow
                icon={<AppIcon name="clock" className="size-[18px]" />}
                label="Employment type"
                value={formatEmployment(job.employment_type)}
              />
              <SidebarInfoRow
                icon={<AppIcon name="banknote" className="size-[18px]" />}
                label="Offered salary"
                value={salaryDisplay}
              />
              <SidebarInfoRow
                icon={<AppIcon name="briefcase" className="size-[18px]" />}
                label="Experience"
                value={job.seniority?.trim() ? job.seniority : "—"}
              />
              <SidebarInfoRow
                icon={<AppIcon name="building" className="size-[18px]" />}
                label="Work arrangement"
                value={workArrangementLabel(job)}
              />
            </div>
          </div>

          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 shadow-[var(--app-shadow-1)]">
            <div className="mb-4 text-[13px] font-semibold text-[var(--app-text-primary)]">Company</div>
            <div className="flex items-start gap-3">
              <JobCompanyMark company={job.company} sourceUrl={job.source_url} size="detail" />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[var(--app-text-primary)]">{job.company}</div>
                {job.location?.trim() ? (
                  <div className="mt-2 flex gap-2 text-[13px] leading-snug text-[var(--app-text-secondary)]">
                    <AppIcon name="map-pin" className="mt-0.5 size-4 shrink-0 text-[var(--app-text-tertiary)]" />
                    <span>{job.location}</span>
                  </div>
                ) : null}
                {companySiteHost ? (
                  <a
                    href={`https://${companySiteHost}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[13px] font-medium text-[var(--app-accent)] underline-offset-4 hover:underline"
                    onClick={() => void postJobEvent(job.id, "click_out", "company site from detail")}
                  >
                    {companySiteHost}
                  </a>
                ) : null}
              </div>
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

          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 shadow-[var(--app-shadow-1)]">
            <div className="text-[12px] font-semibold text-[var(--app-text-primary)]">Fit and match</div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
              Scored automatically against your latest parsed résumé (same signals as discovery ranking).
            </p>
            {fitLoading ? (
              <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                <div className="h-7 w-[40%] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
                <div className="h-2 w-full animate-pulse rounded-full bg-[var(--app-bg-muted)]" />
                <div className="h-3 w-[85%] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
                <div className="h-3 w-[60%] animate-pulse rounded-md bg-[var(--app-bg-muted)]" />
                <p className="pt-1 text-[12px] text-[var(--app-text-tertiary)]">Scoring fit and role match…</p>
              </div>
            ) : null}
            {!fit && !fitLoading && fitError ? (
              <div className="mt-3">
                <p className="text-[12px] leading-relaxed text-[var(--app-badge-red-fg)]">{fitError}</p>
                <AppButton
                  type="button"
                  variant="outline"
                  className="mt-3 w-full justify-center transition-transform active:scale-[0.96]"
                  onClick={() => void loadFit()}
                >
                  Try again
                </AppButton>
              </div>
            ) : null}
            {!fit && !fitLoading && !fitError && isPreviewJob(job) ? (
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
                Preview listings are not scored against your résumé.
              </p>
            ) : null}
            {fit && fitStyle ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                      Overall fit
                    </div>
                    <div className={`text-[22px] font-semibold tabular-nums ${fitStyle.text}`}>{scoreDisplay}%</div>
                  </div>
                  {matchDisplay != null ? (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                        Role match
                      </div>
                      <div className="text-[22px] font-semibold tabular-nums text-[var(--app-text-primary)]">{matchDisplay}%</div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-bg-muted)]">
                  <div className={`h-full rounded-full ${fitStyle.bar}`} style={{ width: `${Math.min(100, scoreDisplay ?? 0)}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
                  {fitStyle.label}
                  {fit.gap_skills?.length ? ` · ${fit.gap_skills.length} skill gap(s)` : ""}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{fit.rationale}</p>
                <AppButton
                  type="button"
                  variant="outline"
                  className="mt-4 w-full justify-center text-[12px] transition-transform active:scale-[0.96]"
                  disabled={fitLoading}
                  onClick={() => void loadFit()}
                >
                  Recalculate
                </AppButton>
              </div>
            ) : null}
          </div>

          {job.source_url ? (
            <ChromePrimaryLink href={job.source_url} target="_blank" rel="noreferrer" className="w-full justify-center">
              View original listing
            </ChromePrimaryLink>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
