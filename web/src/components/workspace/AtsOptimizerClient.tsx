"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ChromePrimaryButton } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";
import { fetchApplicationDetail } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";

import { Gauge, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function AtsOptimizerClient() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId")?.trim() || null;

  const detailQ = useQuery({
    queryKey: queryKeys.applicationDetail(applicationId ?? ""),
    queryFn: () => fetchApplicationDetail(applicationId!),
    enabled: Boolean(applicationId),
  });

  const [jdText, setJdText] = useState("");

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
            <h2 className="text-[20px] font-bold">Upload Your CV</h2>
            <p className="mt-2 text-[var(--app-text-secondary)]">Upload your CV in PDF format</p>
            <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-muted)] text-center">
              <div>
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-[var(--app-blue-50)] text-[var(--app-accent)]">
                  <AppIcon name="file-text" className="size-9" />
                </div>
                <p className="mt-5 font-bold">Drop or select file</p>
                <p className="mt-2 text-[var(--app-text-secondary)]">
                  Drop files here or click to <span className="text-[var(--app-accent)]">browse</span> through your machine.
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-[var(--app-border)] pt-5">
              <h3 className="font-bold">Extracted Content</h3>
              <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--app-border)] bg-white p-5 text-[14px] leading-6 text-[var(--app-text-primary)]">
                John Taylor{"\n"}Digital Marketing Specialist{"\n"}Austin, TX · john.taylor@email.com · (123) 456-7890
                {"\n\n"}Professional Summary{"\n"}Results-driven digital marketer with 5+ years of experience in managing
                multi-channel campaigns, SEO optimization, and data analytics.
              </pre>
            </div>
          </section>
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Job Description</h2>
            <p className="mt-2 text-[var(--app-text-secondary)]">Paste the job description to analyze</p>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="mt-5 min-h-56 w-full rounded-2xl border border-[var(--app-border)] p-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
              placeholder="Paste the job description here…"
            />
            <ChromePrimaryButton className="mt-5" type="button">
              <AppIcon name="analytics" className="size-5" /> Analyse CV
            </ChromePrimaryButton>
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

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="ch-panel p-6">
          <Gauge value={75} label="Match" icon="analytics" />
          <h2 className="mt-8 text-[20px] font-bold">Keywords</h2>
          <p className="mt-3 text-[var(--app-text-secondary)]">
            Your resume has <b>6 out of 10</b> keywords that appear in the job description.
          </p>
        </section>
        <section className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Improvement Suggestions</h2>
          <div className="mt-5 space-y-4">
            <article className="ch-soft-card p-5">
              <b>Add A/B testing example in work experience</b>
              <p className="mt-2 text-[var(--app-text-secondary)]">Show a real example with results.</p>
            </article>
            <article className="ch-soft-card p-5">
              <b>Mention GA4 or updated analytics platform</b>
              <p className="mt-2 text-[var(--app-text-secondary)]">
                Referencing GA4 shows you are up-to-date with key marketing tools.
              </p>
            </article>
          </div>
        </section>
      </div>
    </ProductPageChrome>
  );
}
