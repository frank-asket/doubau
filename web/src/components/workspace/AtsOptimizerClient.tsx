"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AppButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { ProductPageChrome } from "./ProductPageChrome";

type FitResult = {
  score: number;
  match_pct: number;
  rationale: string;
  gap_skills: string[];
  strength_skills: string[];
};

export function AtsOptimizerClient() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FitResult | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      setError(null);
      const r = await fetch("/api/me/jd-fit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          job_description: jd,
          job_title: title.trim() || undefined,
          company: company.trim() || undefined,
        }),
      });
      const body = (await r.json().catch(() => ({}))) as FitResult & { detail?: string };
      if (!r.ok) {
        throw new Error(typeof body.detail === "string" ? body.detail : `Fit failed (${r.status})`);
      }
      return body as FitResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (e: Error) => {
      setResult(null);
      setError(e.message);
    },
  });

  return (
    <ProductPageChrome
      title="ATS optimizer"
      description="Paste a job description (plus optional title and company). We compare it to your latest parsed résumé using the same structured fit model as Job Discovery."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
              Role title (optional)
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
                placeholder="Staff Engineer"
              />
            </label>
            <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
              Company (optional)
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
                placeholder="Acme Ltd"
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Job description
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              className="mt-1 min-h-[220px]"
              placeholder="Paste the full posting text (minimum ~20 characters)."
            />
          </label>
          <AppButton
            type="button"
            disabled={jd.trim().length < 20 || m.isPending}
            onClick={() => m.mutate()}
            className="w-full justify-center sm:w-auto"
          >
            {m.isPending ? "Scoring…" : "Run ATS-style fit"}
          </AppButton>
          {error ? (
            <p className="text-[13px] text-[var(--app-badge-red-fg)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
          {!result ? (
            <p className="text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
              Results include overall score, match percentage, narrative rationale, and gap vs strength skills — powered by the API{" "}
              <span className="font-mono text-[12px]">POST /me/jd-fit</span>.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                    Fit score
                  </div>
                  <div className="tabular-nums text-[36px] font-semibold text-[var(--app-text-primary)]">
                    {Math.round(result.score)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                    Match %
                  </div>
                  <div className="tabular-nums text-[28px] font-semibold text-[var(--app-text-primary)]">
                    {Math.round(result.match_pct)}
                  </div>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{result.rationale}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                    Strengths
                  </div>
                  <ul className="mt-1 list-inside list-disc text-[13px] text-[var(--app-text-secondary)]">
                    {result.strength_skills?.length ? (
                      result.strength_skills.map((s) => <li key={s}>{s}</li>)
                    ) : (
                      <li className="list-none">—</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                    Gaps
                  </div>
                  <ul className="mt-1 list-inside list-disc text-[13px] text-[var(--app-text-secondary)]">
                    {result.gap_skills?.length ? (
                      result.gap_skills.map((s) => <li key={s}>{s}</li>)
                    ) : (
                      <li className="list-none">—</li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ProductPageChrome>
  );
}
