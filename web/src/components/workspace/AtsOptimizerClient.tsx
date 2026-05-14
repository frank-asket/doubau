"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChromePrimaryButton } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";
import { fetchApplicationDetail } from "@/lib/applications-fetch";
import { postJdFit, type JdFitResult } from "@/lib/jd-fit";
import { queryKeys } from "@/lib/query-keys";

import { Gauge, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const JD_MIN_LEN = 20;

type ResumeLatestPayload = {
  status: string;
  file_name?: string | null;
  extracted_text?: string | null;
};

export function AtsOptimizerClient() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId")?.trim() || null;

  const detailQ = useQuery({
    queryKey: queryKeys.applicationDetail(applicationId ?? ""),
    queryFn: () => fetchApplicationDetail(applicationId!),
    enabled: Boolean(applicationId),
  });

  const resumeQ = useQuery({
    queryKey: queryKeys.resumeLatest,
    queryFn: async (): Promise<ResumeLatestPayload | null> => {
      const r = await fetch("/api/me/resume/latest", { cache: "no-store" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("resume");
      return (await r.json()) as ResumeLatestPayload;
    },
  });

  const [jdText, setJdText] = useState("");
  const [fitResult, setFitResult] = useState<JdFitResult | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setJdText("");
      return;
    }
    if (!detailQ.isFetched) return;
    const ex = detailQ.data?.job_description_excerpt;
    if (typeof ex === "string" && ex.trim()) {
      setJdText(ex);
    } else {
      setJdText("");
    }
  }, [applicationId, detailQ.isFetched, detailQ.data?.job_description_excerpt]);

  const roleLine =
    detailQ.data && applicationId ? `${detailQ.data.company} · ${detailQ.data.job_title}` : null;

  const resumeReady = useMemo(() => {
    const s = resumeQ.data?.status;
    return s === "PARSED" || s === "EMBEDDED";
  }, [resumeQ.data?.status]);

  const resumePreview = useMemo(() => {
    const t = (resumeQ.data?.extracted_text ?? "").trim();
    if (!t) return "";
    return t.length > 2800 ? `${t.slice(0, 2800)}…` : t;
  }, [resumeQ.data?.extracted_text]);

  const jdFitM = useMutation({
    mutationFn: () =>
      postJdFit({
        job_description: jdText.trim(),
        company: detailQ.data?.company ?? null,
        job_title: detailQ.data?.job_title ?? null,
      }),
    onSuccess: (data) => {
      setFitResult(data);
    },
  });

  const jdOk = jdText.trim().length >= JD_MIN_LEN;
  const canAnalyse = resumeReady && jdOk && !jdFitM.isPending;

  return (
    <ProductPageChrome title="ATS Optimizer">
      {applicationId ? (
        <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-4 py-3 text-[13px] leading-6 text-[var(--app-text-secondary)]">
          {detailQ.isLoading ? <p>Loading application context…</p> : null}
          {detailQ.isError ? (
            <p className="text-[var(--app-badge-red-fg)]">Could not load this application. Check the link or try again.</p>
          ) : null}
          {detailQ.data ? (
            <>
              <p>
                <span className="font-semibold text-[var(--app-text-primary)]">Linked application:</span> {roleLine}
              </p>
              {!detailQ.data.job_description_excerpt?.trim() ? (
                <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
                  No job description matched the catalog for this posting URL yet—paste the JD below manually.
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
                  Job description field prefilled from the indexed listing when available.
                </p>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <main className="space-y-4">
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Your résumé</h2>
            <p className="mt-2 text-[var(--app-text-secondary)]">
              Analysis uses your latest uploaded résumé (parsed text). Upload or replace it from the dashboard if
              needed.
            </p>
            {resumeQ.isLoading ? (
              <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">Loading résumé…</p>
            ) : null}
            {resumeQ.isError ? (
              <p className="mt-4 text-[13px] text-[var(--app-badge-red-fg)]">Could not load résumé metadata.</p>
            ) : null}
            {!resumeQ.isLoading && resumeQ.data === null ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] p-5 text-[13px] text-[var(--app-text-secondary)]">
                <p>No résumé on file yet.</p>
                <Link
                  href="/app/dashboard"
                  className="mt-3 inline-flex font-medium text-[var(--app-accent)] hover:underline"
                >
                  Go to dashboard to upload
                </Link>
              </div>
            ) : null}
            {resumeQ.data ? (
              <div className="mt-4 space-y-2">
                <p className="text-[12px] text-[var(--app-text-tertiary)]">
                  <span className="font-semibold text-[var(--app-text-primary)]">File:</span>{" "}
                  {resumeQ.data.file_name ?? "Résumé"} · <span className="font-mono">{resumeQ.data.status}</span>
                </p>
                {!resumeReady ? (
                  <p className="text-[13px] text-[var(--app-badge-red-fg)]">
                    Résumé is not parsed yet (or parsing failed). Fix upload errors on the dashboard, then return here.
                  </p>
                ) : null}
                {resumePreview ? (
                  <div className="mt-2 border-t border-[var(--app-border)] pt-4">
                    <h3 className="font-bold">Extracted text (preview)</h3>
                    <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--app-border)] bg-white p-5 text-[13px] leading-6 text-[var(--app-text-primary)]">
                      {resumePreview}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Job description</h2>
            <p className="mt-2 text-[var(--app-text-secondary)]">
              Paste the full posting (at least {JD_MIN_LEN} characters). We compare it to your résumé via the same
              backend used for discovery fit scoring.
            </p>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="mt-5 min-h-56 w-full rounded-2xl border border-[var(--app-border)] p-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
              placeholder="Paste the job description here…"
            />
            <p className="mt-2 text-[12px] text-[var(--app-text-tertiary)]">
              {jdText.trim().length}/{JD_MIN_LEN} characters minimum
            </p>
            <ChromePrimaryButton
              className="mt-5"
              type="button"
              disabled={!canAnalyse}
              onClick={() => void jdFitM.mutate()}
            >
              <AppIcon name="analytics" className="size-5" /> Analyse CV
            </ChromePrimaryButton>
            {jdFitM.isError ? (
              <p className="mt-3 text-[13px] text-[var(--app-badge-red-fg)]" role="alert">
                {jdFitM.error instanceof Error ? jdFitM.error.message : "Analysis failed."}
              </p>
            ) : null}
          </section>
        </main>
        <aside className="space-y-4">
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">ATS Tips</h2>
            {[
              ["Use Simple Formatting", "Stick to standard fonts and simple layouts"],
              ["Match Keywords", "Use exact phrases from the job description"],
              ["Highlight Achievements", "Include measurable results and metrics"],
              ["Label Sections Clearly", "Use standard headings like Work Experience"],
              ["Use Chronological Order", "List your most recent experience first"],
            ].map(([title, body]) => (
              <article key={title} className="ch-soft-card mt-4 p-4">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-[14px] text-[var(--app-text-secondary)]">{body}</p>
              </article>
            ))}
          </section>
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Common ATS Terms</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Technical Skills", "Leadership", "Project Management", "Communication", "Agile", "Results-Driven"].map(
                (term) => (
                  <Tag key={term}>{term}</Tag>
                ),
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Match scores</h2>
          {fitResult ? (
            <>
              <div className="mt-4 flex justify-center">
                <Gauge value={Math.round(fitResult.match_pct)} label="Role match %" icon="analytics" />
              </div>
              <p className="mt-4 text-center text-[13px] text-[var(--app-text-secondary)]">
                Overall fit score: <span className="font-semibold tabular-nums">{Math.round(fitResult.score)}</span> / 100
              </p>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">
              Run <strong className="font-medium">Analyse CV</strong> to see match percentage and keyword-style gaps from
              the model.
            </p>
          )}
        </section>
        <section className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Model output</h2>
          {fitResult ? (
            <div className="mt-5 space-y-5">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--app-text-primary)]">Rationale</h3>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[var(--app-text-secondary)]">
                  {fitResult.rationale}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-[14px] font-bold text-[var(--app-text-primary)]">Strengths</h3>
                  <ul className="mt-2 list-inside list-disc text-[13px] text-[var(--app-text-secondary)]">
                    {fitResult.strength_skills.length ? (
                      fitResult.strength_skills.map((s) => <li key={s}>{s}</li>)
                    ) : (
                      <li className="list-none text-[var(--app-text-tertiary)]">None listed</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-[var(--app-text-primary)]">Gaps</h3>
                  <ul className="mt-2 list-inside list-disc text-[13px] text-[var(--app-text-secondary)]">
                    {fitResult.gap_skills.length ? (
                      fitResult.gap_skills.map((s) => <li key={s}>{s}</li>)
                    ) : (
                      <li className="list-none text-[var(--app-text-tertiary)]">None listed</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-[13px] text-[var(--app-text-secondary)]">
              Suggestions are generated by the configured chat model comparing your résumé text to the job description.
            </p>
          )}
        </section>
      </div>
    </ProductPageChrome>
  );
}
