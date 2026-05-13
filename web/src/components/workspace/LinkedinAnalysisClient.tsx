"use client";

import Link from "next/link";

import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { AppButton } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import {
  getResumeStructured,
  linkedinStyleScores,
  overallProfileScore,
  type ProfileDto,
  type ResumeLatestDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { Gauge, ProgressLine } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function LinkedinAnalysisClient() {
  const qc = useQueryClient();
  const [section, setSection] = useState<string>("Headline");
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

  const scoreForTab: Record<string, number> = {
    Headline: scores.headline,
    Summary: scores.summary,
    Experience: scores.experience,
    Education: scores.education,
    Other: scores.other,
  };
  const tabScore = scoreForTab[section] ?? scores.headline;

  const detailForSection = () => {
    switch (section) {
      case "Headline":
        return (
          <>
            <p className="text-[15px]">
              <b>Current headline:</b>{" "}
              <i>{headlineText || "—"}</i>
            </p>
            <article className="ch-soft-card mt-6 p-5">
              <h3 className="font-bold">Hint</h3>
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
            <p className="text-[15px]">
              <b>Summary:</b> {summaryText ? summaryText.slice(0, 600) : "—"}
              {summaryText.length > 600 ? "…" : ""}
            </p>
            <article className="ch-soft-card mt-6 p-5">
              <h3 className="font-bold">Hint</h3>
              <p className="mt-3 text-[15px] leading-6 text-[var(--app-text-secondary)]">
                Strong summaries quantify impact and mirror target roles. Expand bullets on your CV file and re-upload to refresh.
              </p>
            </article>
          </>
        );
      default:
        return (
          <p className="text-[15px] text-[var(--app-text-secondary)]">
            Section scores reflect parsed résumé structure (experience bullets, education rows, skills/links density).
          </p>
        );
    }
  };

  return (
    <ProductPageChrome
      title="LinkedIn Analysis"
      description="Heuristic scoring from your latest Doubow résumé parse — optimize your CV, then re-upload."
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
      {resumeQ.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading résumé…</p>
      ) : resumeQ.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load résumé.</p>
      ) : !resumeQ.data ? (
        <div className="ch-panel p-6">
          <p className="text-[15px] text-[var(--app-text-secondary)]">
            Upload a résumé to analyze headline and summary strength.
          </p>
          <Link href="/app/cv-builder" className="mt-4 inline-flex font-semibold text-[var(--app-accent)] hover:underline">
            Go to CV Builder
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[390px_1fr]">
          <aside className="ch-panel flex flex-col p-7">
            <Gauge value={overall} label="Overall score" icon="analytics" />
            <div className="my-8 border-t border-[var(--app-border)]" />
            <div className="space-y-4">
              {sections.map(([label, score, tone]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSection(label)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-full bg-[var(--app-bg-muted)] px-5 text-left font-semibold transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-blue-50)] active:scale-[0.96] ${
                    section === label ? "ring-2 ring-[var(--app-accent)]" : ""
                  }`}
                >
                  <span className={section === label ? "text-[var(--app-accent)]" : ""}>{label}</span>
                  <span
                    className={
                      tone === "red"
                        ? "text-[var(--app-danger)]"
                        : tone === "pink"
                          ? "text-[#e879d2]"
                          : "text-[var(--app-success)]"
                    }
                  >
                    {score}/10
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-auto pt-10">
              <ChromePrimaryLink href="/app/cv-builder" className="w-full">
                <AppIcon name="upload" className="size-5" /> Update résumé
              </ChromePrimaryLink>
            </div>
          </aside>

          <section className="ch-panel p-7">
            <h2 className="text-[20px] font-bold">
              {section}: <span className="text-[var(--app-success)]">{tabScore}/10</span>
            </h2>
            <div className="my-5 border-t border-dashed border-[var(--app-border)]" />
            {detailForSection()}
          </section>
        </div>
      )}

      <section className="ch-panel p-6">
        <h2 className="text-[20px] font-bold">LinkedIn profile URL</h2>
        <p className="mt-2 text-[var(--app-text-secondary)]">
          Doubow does not scrape LinkedIn. Save your public profile URL on your record — scoring above still uses your uploaded résumé text only.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="h-14 min-w-0 flex-1 rounded-full border border-[var(--app-border)] px-6 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
            placeholder="https://www.linkedin.com/in/username"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            type="url"
            autoComplete="url"
            aria-label="LinkedIn profile URL"
          />
          <AppButton
            type="button"
            variant="primary"
            disabled={saveLinkedIn.isPending || profileQ.isLoading}
            onClick={() => saveLinkedIn.mutate()}
          >
            {saveLinkedIn.isPending ? "Saving…" : "Save URL"}
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
        <div className="mt-8">
          <ProgressLine value={overall} />
        </div>
      </section>
    </ProductPageChrome>
  );
}
