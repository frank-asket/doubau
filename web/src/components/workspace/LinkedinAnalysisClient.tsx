"use client";

import Link from "next/link";

import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { AppButton } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import {
  getResumeStructured,
  linkedinStyleScores,
  overallProfileScore,
  resumeSkills,
  type ProfileDto,
  type ResumeLatestDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { Gauge, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ResumePollDto = {
  status?: string | null;
  error?: string | null;
};

type SectionId = "Headline" | "Summary" | "Experience" | "Education" | "Other";

function sectionLabel(id: SectionId): string {
  if (id === "Other") return "Skills & links";
  return id;
}

export function LinkedinAnalysisClient() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<SectionId>("Headline");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const profileQ = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return (await r.json()) as ProfileDto;
    },
  });

  useEffect(() => {
    const g = profileQ.data?.goals;
    const raw = g && typeof g.linkedin_profile_url === "string" ? g.linkedin_profile_url : "";
    setLinkedinUrl(raw);
  }, [profileQ.data]);

  const saveLinkedIn = useMutation({
    mutationFn: async () => {
      const base =
        profileQ.data?.goals && typeof profileQ.data.goals === "object"
          ? { ...profileQ.data.goals }
          : {};
      const trimmed = linkedinUrl.trim();
      if (trimmed) base.linkedin_profile_url = trimmed;
      else delete base.linkedin_profile_url;
      const r = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goals: base }),
      });
      if (!r.ok) throw new Error("Could not save profile.");
      return (await r.json()) as ProfileDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });

  const resumeQ = useQuery({
    queryKey: queryKeys.resumeLatest,
    queryFn: async () => {
      const r = await fetch("/api/me/resume/latest", { cache: "no-store" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("resume");
      return (await r.json()) as ResumeLatestDto;
    },
  });

  const pollUntilParsed = useCallback(async (id: string) => {
    const maxAttempts = 48;
    for (let i = 0; i < maxAttempts; i++) {
      const rr = await fetch(`/api/me/resume/${id}`, { cache: "no-store" });
      if (!rr.ok) {
        const errBody = (await rr.json().catch(() => ({}))) as { detail?: string };
        throw new Error(errBody.detail ?? `Status ${rr.status}`);
      }
      const data = (await rr.json()) as ResumePollDto;
      const st = (data.status ?? "").toUpperCase();
      if (st === "PARSED" || st === "EMBEDDED") return;
      if (st === "FAILED") throw new Error(data.error ?? "Parsing failed.");
      await sleep(500);
    }
    throw new Error("Parsing is taking longer than expected. Refresh in a moment.");
  }, []);

  const uploadResume = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const up = await fetch("/api/me/resume", { method: "POST", body: fd });
      if (!up.ok) {
        const err = (await up.json().catch(() => ({}))) as { detail?: unknown };
        const msg =
          typeof err.detail === "string"
            ? err.detail
            : Array.isArray(err.detail)
              ? err.detail
                  .map((x) =>
                    typeof x === "object" && x && "msg" in x ? String((x as { msg?: string }).msg) : "",
                  )
                  .filter(Boolean)
                  .join(" ")
              : `Upload failed (${up.status})`;
        throw new Error(msg);
      }
      const body = (await up.json()) as { id?: string };
      if (!body.id) throw new Error("Upload response missing id.");
      await pollUntilParsed(body.id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.resumeLatest });
    },
  });

  const structured = useMemo(
    () => getResumeStructured(resumeQ.data?.parsed_json ?? null),
    [resumeQ.data?.parsed_json],
  );

  const extractedFallback =
    typeof resumeQ.data?.extracted_text === "string" ? resumeQ.data.extracted_text : null;

  const scores = useMemo(
    () => linkedinStyleScores(structured, extractedFallback),
    [structured, extractedFallback],
  );

  const overall = overallProfileScore(scores);
  const hasResume = Boolean(resumeQ.data);
  const resumeStatus = (resumeQ.data?.status ?? "").toUpperCase();
  const isParsing = hasResume && resumeStatus === "UPLOADED";

  const linkedinOid = useMemo(() => {
    const g = profileQ.data?.goals;
    if (!g || typeof g !== "object") return null;
    const lp = (g as Record<string, unknown>).linkedin_profile;
    if (!lp || typeof lp !== "object") return null;
    const o = lp as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const email = typeof o.email === "string" ? o.email : null;
    if (!name && !email) return null;
    return { name, email };
  }, [profileQ.data?.goals]);

  const headlineText =
    typeof structured?.headline === "string" && structured.headline.trim()
      ? structured.headline.trim()
      : extractedFallback?.split("\n").find((l) => l.trim())?.trim() ?? "";

  const summaryText = typeof structured?.summary === "string" ? structured.summary.trim() : "";

  const skills = useMemo(() => resumeSkills(structured), [structured]);

  const sections = useMemo(
    () =>
      [
        ["Headline", scores.headline, scores.headline >= 6 ? "green" : "red"],
        ["Summary", scores.summary, scores.summary >= 6 ? "green" : "red"],
        ["Experience", scores.experience, scores.experience >= 6 ? "green" : "pink"],
        ["Education", scores.education, scores.education >= 6 ? "green" : "pink"],
        ["Other", scores.other, scores.other >= 6 ? "green" : "pink"],
      ] as const,
    [scores],
  );

  const scoreForTab: Record<SectionId, number> = {
    Headline: scores.headline,
    Summary: scores.summary,
    Experience: scores.experience,
    Education: scores.education,
    Other: scores.other,
  };
  const tabScore = scoreForTab[section];

  const experienceBlocks = useMemo(() => {
    const exp = Array.isArray(structured?.experience) ? structured!.experience : [];
    return exp.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }, [structured]);

  const educationBlocks = useMemo(() => {
    const edu = Array.isArray(structured?.education) ? structured!.education : [];
    return edu.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }, [structured]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    uploadResume.mutate(f);
  }

  const detailForSection = () => {
    if (!hasResume) {
      return (
        <p className="text-[15px] leading-7 text-[var(--app-text-secondary)]">
          Upload a LinkedIn PDF export or a résumé file — Doubow scores the parsed text only (no LinkedIn scraping).
        </p>
      );
    }
    if (isParsing) {
      return (
        <p className="text-[15px] text-[var(--app-text-secondary)]">
          Your file is uploaded; parsing is still running. Scores will refresh in a few seconds.
        </p>
      );
    }
    switch (section) {
      case "Headline":
        return (
          <>
            <p className="text-[15px] leading-7">
              <span className="font-semibold text-[var(--app-text-primary)]">Current headline:</span>{" "}
              <span className="italic text-[var(--app-text-secondary)]">{headlineText || "—"}</span>
            </p>
            <article className="ch-soft-card mt-6 p-5">
              <h3 className="font-bold text-[var(--app-text-primary)]">Hint</h3>
              <p className="mt-3 text-[15px] leading-6 text-[var(--app-text-secondary)]">
                Aim for a concise headline (roughly one line) that states role, domain, and one proof point. This score is a
                heuristic from your parsed résumé — not a LinkedIn API scan.
              </p>
            </article>
          </>
        );
      case "Summary":
        return (
          <>
            <p className="text-[15px] leading-7 text-[var(--app-text-primary)]">
              <span className="font-semibold">Summary:</span>{" "}
              <span className="text-[var(--app-text-secondary)]">
                {summaryText ? summaryText.slice(0, 600) : "—"}
                {summaryText.length > 600 ? "…" : ""}
              </span>
            </p>
            <article className="ch-soft-card mt-6 p-5">
              <h3 className="font-bold text-[var(--app-text-primary)]">Hint</h3>
              <p className="mt-3 text-[15px] leading-6 text-[var(--app-text-secondary)]">
                Strong summaries quantify impact and mirror target roles. Expand bullets on your CV file and re-upload to
                refresh.
              </p>
            </article>
          </>
        );
      case "Experience":
        return (
          <>
            {experienceBlocks.length ? (
              <ul className="space-y-5">
                {experienceBlocks.map((row, i) => {
                  const title = typeof row.title === "string" ? row.title : "";
                  const company = typeof row.company === "string" ? row.company : "";
                  const dates = typeof row.dates === "string" ? row.dates : "";
                  const bullets = Array.isArray(row.bullets)
                    ? row.bullets.filter((b): b is string => typeof b === "string" && b.trim() !== "")
                    : [];
                  const head = [title, company].filter(Boolean).join(" · ");
                  return (
                    <li key={i} className="text-[15px]">
                      {head ? (
                        <p className="font-semibold text-[var(--app-text-primary)]">
                          {head}
                          {dates ? <span className="font-normal text-[var(--app-text-tertiary)]"> · {dates}</span> : null}
                        </p>
                      ) : null}
                      {bullets.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--app-text-secondary)]">
                          {bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[var(--app-text-tertiary)]">No bullets extracted for this role.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[15px] text-[var(--app-text-secondary)]">
                No structured experience rows yet — scoring still uses bullet density when the parser finds them.
              </p>
            )}
            <article className="ch-soft-card mt-6 p-5">
              <h3 className="font-bold text-[var(--app-text-primary)]">Hint</h3>
              <p className="mt-3 text-[15px] leading-6 text-[var(--app-text-secondary)]">
                Lead with outcomes (metrics, scope, timeframe). Re-upload after you tighten bullets in your source file.
              </p>
            </article>
          </>
        );
      case "Education":
        return (
          <>
            {educationBlocks.length ? (
              <ul className="space-y-3">
                {educationBlocks.map((row, i) => {
                  const degree = typeof row.degree === "string" ? row.degree : "";
                  const school = typeof row.school === "string" ? row.school : "";
                  const line = [degree, school].filter(Boolean).join(" — ");
                  return (
                    <li key={i} className="text-[15px] text-[var(--app-text-primary)]">
                      {line || "—"}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[15px] text-[var(--app-text-secondary)]">No education rows in the structured parse.</p>
            )}
          </>
        );
      case "Other":
        return (
          <>
            <p className="text-[15px] text-[var(--app-text-secondary)]">
              This bucket scores skills and optional links detected in your parse.
            </p>
            {skills.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Tag key={s} active>
                    {s}
                  </Tag>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[15px] text-[var(--app-text-tertiary)]">No skills list in structured data.</p>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const toneClass = (tone: "green" | "red" | "pink") =>
    tone === "red"
      ? "text-[var(--app-danger)]"
      : tone === "pink"
        ? "text-[#e879d2]"
        : "text-[var(--app-success)]";

  return (
    <ProductPageChrome
      title="LinkedIn Analysis"
      description="Heuristic scoring from your latest Doubow résumé parse — optimize your CV or LinkedIn export, then re-upload."
    >
      {linkedinOid ? (
        <div className="mb-4 rounded-[24px] border border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_8%,var(--app-bg-elevated))] px-5 py-4">
          <p className="text-[13px] leading-6 text-[var(--app-text-secondary)]">
            <span className="font-semibold text-[var(--app-text-primary)]">LinkedIn (OpenID) synced</span>
            {linkedinOid.name ? ` — ${linkedinOid.name}` : ""}
            {linkedinOid.email ? (
              <>
                {" "}
                <span className="text-[var(--app-text-tertiary)]">({linkedinOid.email})</span>
              </>
            ) : null}
            . Add your public profile URL below if you want it on file; Doubow never posts for you.
          </p>
          <Link
            href="/app/settings"
            className="mt-2 inline-flex text-[13px] font-semibold text-[var(--app-accent)] hover:underline"
          >
            Manage in Settings
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 shadow-[var(--app-shadow-1)]">
          <h2 className="text-[18px] font-bold text-[var(--app-text-primary)]">LinkedIn Profile URL</h2>
          <p className="mt-2 text-[14px] leading-6 text-[var(--app-text-secondary)]">
            Save your public profile link to your Doubow profile. Scoring below still uses your uploaded file — we do not
            scrape LinkedIn.
          </p>
          <p id="linkedin-url-run-help" className="sr-only">
            Run saves your public LinkedIn URL to your Doubow profile only. Doubow does not scrape or visit LinkedIn.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              className="h-14 min-w-0 flex-1 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-page)] px-6 text-[15px] outline-none transition focus:ring-2 focus:ring-[var(--app-focus-ring)]"
              placeholder="https://www.linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              type="url"
              autoComplete="url"
              aria-label="LinkedIn profile URL"
              aria-describedby="linkedin-url-run-help"
            />
            <AppButton
              type="button"
              variant="primary"
              className="h-14 shrink-0 rounded-full px-8"
              disabled={saveLinkedIn.isPending || profileQ.isLoading}
              onClick={() => saveLinkedIn.mutate()}
              title="Saves your public LinkedIn URL to your profile only. Doubow does not scrape LinkedIn."
              aria-describedby="linkedin-url-run-help"
            >
              {saveLinkedIn.isPending ? "Running…" : "Run"}
            </AppButton>
          </div>
          {saveLinkedIn.isSuccess ? (
            <p className="mt-3 text-[13px] text-[var(--app-success)]">Saved to your profile.</p>
          ) : null}
          {saveLinkedIn.isError ? (
            <p className="mt-3 text-[13px] text-[var(--app-danger)]" role="alert">
              {saveLinkedIn.error instanceof Error ? saveLinkedIn.error.message : "Save failed."}
            </p>
          ) : null}
        </div>

        <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 shadow-[var(--app-shadow-1)]">
          <h2 className="text-[18px] font-bold text-[var(--app-text-primary)]">Or upload your LinkedIn data</h2>
          <p className="mt-2 text-[14px] leading-6 text-[var(--app-text-secondary)]">
            Export your LinkedIn profile as PDF (or use a .docx résumé). We store and parse it as your Doubow résumé — the
            same pipeline as CV Builder.
          </p>
          <div className="mt-4 rounded-[16px] border border-[var(--app-border-strong)] bg-[var(--app-bg-muted)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--app-text-primary)]">Save as PDF from LinkedIn</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-5 text-[var(--app-text-secondary)]">
              <li>Open your profile while signed in.</li>
              <li>Use your browser print dialog → Save as PDF (or LinkedIn&apos;s export if available).</li>
              <li>Upload the PDF here. Parsing may take a few seconds.</li>
            </ol>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Upload LinkedIn PDF or résumé"
            onChange={onPickFile}
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <AppButton
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={uploadResume.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <AppIcon name="upload" className="size-5" />
              {uploadResume.isPending ? "Uploading…" : "Choose file"}
            </AppButton>
            <span className="text-[13px] text-[var(--app-text-tertiary)]">PDF or DOCX · max 10MB</span>
          </div>
          {uploadResume.isError ? (
            <p className="mt-3 text-[13px] text-[var(--app-danger)]" role="alert">
              {uploadResume.error instanceof Error ? uploadResume.error.message : "Upload failed."}
            </p>
          ) : null}
          {uploadResume.isSuccess ? (
            <p className="mt-3 text-[13px] text-[var(--app-success)]">Uploaded and parsed. Scores updated.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-[24px] border border-[var(--app-border)] shadow-[var(--app-shadow-1)]">
        {resumeQ.isLoading ? (
          <div className="bg-[var(--app-bg-elevated)] p-10 text-center text-[14px] text-[var(--app-text-secondary)]">
            Loading résumé…
          </div>
        ) : resumeQ.isError ? (
          <div className="bg-[var(--app-bg-elevated)] p-10 text-center text-[14px] text-[var(--app-badge-red-fg)]">
            Could not load résumé.
          </div>
        ) : (
          <div className="grid min-h-[min(70vh,560px)] lg:grid-cols-[minmax(220px,280px)_1fr]">
            <aside className="flex flex-col border-b border-[color-mix(in_srgb,var(--app-sidebar-fg)_12%,transparent)] bg-[var(--app-sidebar)] p-6 text-[var(--app-sidebar-fg)] lg:border-b-0 lg:border-r">
              {hasResume && !isParsing ? (
                <Gauge value={overall} label="Overall score" icon="analytics" />
              ) : (
                <div className="mx-auto grid size-56 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-sidebar-fg)_08%,transparent)] text-center">
                  <div>
                    <AppIcon name="analytics" className="mx-auto size-6 text-[var(--app-accent)]" />
                    <div className="mt-2 text-[28px] font-bold tabular-nums text-[var(--app-sidebar-muted)]">—</div>
                    <div className="text-[13px] text-[var(--app-sidebar-muted)]">Overall score</div>
                  </div>
                </div>
              )}
              <div className="my-8 border-t border-[color-mix(in_srgb,var(--app-sidebar-fg)_12%,transparent)]" />
              <nav className="flex flex-col gap-1" aria-label="Profile sections">
                {sections.map(([label, score, tone]) => {
                  const id = label as SectionId;
                  const active = section === id;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSection(id)}
                      className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[14px] font-semibold transition-colors ${
                        active
                          ? "bg-[var(--app-sidebar-active-bg)] text-[var(--app-sidebar-fg)]"
                          : "text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-hover-bg)] hover:text-[var(--app-sidebar-fg)]"
                      }`}
                    >
                      <span>{sectionLabel(id)}</span>
                      <span className={hasResume && !isParsing ? toneClass(tone) : "text-[var(--app-sidebar-muted)]"}>
                        {hasResume && !isParsing ? `${score}/10` : "—"}
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="mt-auto pt-8">
                <ChromePrimaryLink href="/app/cv-builder" className="w-full justify-center">
                  <AppIcon name="upload" className="size-5" /> CV Builder
                </ChromePrimaryLink>
              </div>
            </aside>

            <div className="flex flex-col bg-[var(--app-bg-elevated)] p-6 lg:p-8">
              {hasResume && !isParsing ? (
                <div className="mb-6">
                  <ProgressLine value={overall} />
                </div>
              ) : null}
              <h2 className="text-[20px] font-bold text-[var(--app-text-primary)]">
                {sectionLabel(section)}:{" "}
                <span className="text-[var(--app-success)]">
                  {hasResume && !isParsing ? `${tabScore}/10` : "—"}
                </span>
              </h2>
              <div className="my-5 border-t border-dashed border-[var(--app-border)]" />
              {detailForSection()}
            </div>
          </div>
        )}
      </div>
    </ProductPageChrome>
  );
}
