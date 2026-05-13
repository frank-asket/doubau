"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { ChromePrimaryButton } from "@/components/ui/chrome-motion";

import { InlineStatPair, MixPanel, SkillTriadBoard } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type FitScoreOut = {
  score: number;
  match_pct: number;
  rationale: string;
  gap_skills: string[];
  strength_skills: string[];
};

async function postJdFit(body: {
  job_description: string;
  job_title?: string | null;
  company?: string | null;
}): Promise<FitScoreOut> {
  const r = await fetch("/api/me/jd-fit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as FitScoreOut & { detail?: string };
  if (!r.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? JSON.stringify(data.detail)
          : `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return data as FitScoreOut;
}

export function SkillGapAnalysisClient() {
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jd, setJd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runM = useMutation({
    mutationFn: () =>
      postJdFit({
        job_description: jd.trim(),
        job_title: jobTitle.trim() || null,
        company: company.trim() || null,
      }),
    onMutate: () => setError(null),
    onError: (e) => setError(e instanceof Error ? e.message : "Analysis failed."),
  });

  const result = runM.data;
  const canRun = jd.trim().length >= 20 && !runM.isPending;

  return (
    <ProductPageChrome
      title="Skills gap"
      description="Paste a target job description. Doubow compares it to your latest parsed résumé via the same JD-fit model used in Discovery — surfacing gap skills, strengths, and rationale."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 sm:p-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Job context
          </h2>
          <label className="mt-4 block text-[13px] font-medium text-[var(--app-text-primary)]">
            Role title <span className="font-normal text-[var(--app-text-tertiary)]">(optional)</span>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="mt-2 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
              placeholder="e.g. Senior Product Manager"
            />
          </label>
          <label className="mt-4 block text-[13px] font-medium text-[var(--app-text-primary)]">
            Company <span className="font-normal text-[var(--app-text-tertiary)]">(optional)</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-2 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
              placeholder="e.g. Acme Ltd"
            />
          </label>
          <label className="mt-4 block text-[13px] font-medium text-[var(--app-text-primary)]">
            Job description <span className="text-[var(--app-danger)]">*</span>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={14}
              className="mt-2 w-full resize-y rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2.5 text-[14px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
              placeholder="Paste the full posting (minimum 20 characters). Bullet responsibilities and requirements work best."
            />
          </label>
          <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
            Requires a parsed résumé on file and{" "}
            <code className="rounded bg-[var(--app-bg-muted)] px-1 py-0.5 text-[11px]">DOUBOW_OPENAI_API_KEY</code> on the API.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ChromePrimaryButton type="button" disabled={!canRun} onClick={() => runM.mutate()}>
              {runM.isPending ? "Analyzing…" : "Run skills gap"}
            </ChromePrimaryButton>
            <Link
              href="/app/dashboard"
              className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] px-4 text-[13px] font-medium text-[var(--app-accent)] underline-offset-4 hover:underline"
            >
              Upload résumé
            </Link>
          </div>
          {error ? (
            <p className="mt-4 text-[13px] text-[var(--app-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <aside className="space-y-4">
          {result ? (
            <>
              <MixPanel variant="accent">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Fit snapshot
                </p>
                <div className="mt-3">
                  <InlineStatPair
                    leftLabel="Overall score"
                    leftValue={String(Math.round(result.score))}
                    rightLabel="Role alignment"
                    rightValue={`${Math.round(result.match_pct)}%`}
                  />
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{result.rationale}</p>
              </MixPanel>

              <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                  Critical / partial / strengths
                </p>
                <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
                  Gaps map to “critical”; the model does not return a partial band yet — that column explains the gap.
                </p>
                <div className="mt-4">
                  <SkillTriadBoard
                    critical={result.gap_skills}
                    partial={[]}
                    strengths={result.strength_skills}
                    criticalTitle="Skills to strengthen"
                    partialTitle="Partial / emerging"
                    strengthsTitle="Strengths to emphasize"
                    emptyHint="None highlighted — see rationale."
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/25 p-5 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
              Results appear here after you run an analysis. Turn gaps into milestones on{" "}
              <Link href="/app/career-steps" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                Career steps
              </Link>
              .
            </div>
          )}
        </aside>
      </div>
    </ProductPageChrome>
  );
}
