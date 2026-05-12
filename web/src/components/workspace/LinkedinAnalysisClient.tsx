"use client";

import Link from "next/link";

import { ChromePrimaryButton, ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/app-icon";
import {
  getResumeStructured,
  linkedinStyleScores,
  overallProfileScore,
  type ResumeLatestDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { Gauge, ProgressLine } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function LinkedinAnalysisClient() {
  const [section, setSection] = useState<string>("Headline");

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
          Doubow does not fetch LinkedIn automatically yet. Paste a URL for your records — analysis above uses your uploaded résumé only.
        </p>
        <div className="mt-5 flex gap-3">
          <input
            className="h-14 flex-1 rounded-full border border-[var(--app-border)] px-6 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
            placeholder="https://www.linkedin.com/in/username"
            readOnly
            aria-readonly
          />
          <ChromePrimaryButton type="button" className="opacity-60" disabled title="Coming soon">
            <AppIcon name="arrow-up-right" className="size-5" /> Run
          </ChromePrimaryButton>
        </div>
        <div className="mt-8">
          <ProgressLine value={overall} />
        </div>
      </section>
    </ProductPageChrome>
  );
}
