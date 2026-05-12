"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ChromePrimaryButton } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";
import { fetchApplications, type ApplicationRow } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";

import { Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export type InterviewPrepPayload = {
  themes: string[];
  suggested_questions: string[];
  talking_points: string[];
};

function prepPriority(status: string): number {
  if (status === "SUBMITTED") return 0;
  if (status === "APPROVED") return 1;
  if (status === "PENDING_APPROVAL") return 2;
  if (status === "DRAFTED" || status === "DISCOVERED") return 3;
  return 4;
}

function sortAppsForPrep(apps: ApplicationRow[]) {
  return [...apps].sort((a, b) => prepPriority(a.status) - prepPriority(b.status));
}

export function InterviewPrepClient() {
  const appsQ = useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
  });

  const sorted = useMemo(() => sortAppsForPrep(appsQ.data ?? []), [appsQ.data]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (selectedId || sorted.length === 0) return;
    setSelectedId(sorted[0]!.id);
  }, [sorted, selectedId]);

  const prepM = useMutation({
    mutationFn: async (applicationId: string) => {
      const r = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/interview_prep`, {
        method: "POST",
      });
      const body = (await r.json().catch(() => ({}))) as InterviewPrepPayload & { detail?: string };
      if (!r.ok) {
        throw new Error(typeof body.detail === "string" ? body.detail : `Prep failed (${r.status})`);
      }
      return body as InterviewPrepPayload;
    },
  });

  const selectedApp = sorted.find((a) => a.id === selectedId);
  const result = prepM.data;

  return (
    <ProductPageChrome
      title="Interview prep"
      description="Doubow pulls likely questions, themes, and STAR-ready talking points from your résumé context and the real job description for each application — so you walk in knowing why you fit."
    >
      <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <label htmlFor="prep-application" className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Application
            </label>
            <select
              id="prep-application"
              className="w-full max-w-xl rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2.5 text-[14px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
              value={selectedId}
              disabled={appsQ.isLoading || sorted.length === 0}
              onChange={(e) => {
                setSelectedId(e.target.value);
                prepM.reset();
              }}
            >
              {sorted.length === 0 ? (
                <option value="">No applications yet</option>
              ) : (
                sorted.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company} — {a.job_title} · {a.status.replaceAll("_", " ")}
                  </option>
                ))
              )}
            </select>
            {selectedApp?.source_url ? (
              <p className="text-[12px] text-[var(--app-text-secondary)]">
                Source:{" "}
                <a
                  href={selectedApp.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline"
                >
                  Job posting
                  <AppIcon name="arrow-up-right" className="ml-0.5 inline size-3.5 align-text-bottom opacity-80" />
                </a>
              </p>
            ) : null}
          </div>
          <ChromePrimaryButton
            type="button"
            className="shrink-0"
            disabled={!selectedId || prepM.isPending || sorted.length === 0}
            onClick={() => selectedId && prepM.mutate(selectedId)}
          >
            {prepM.isPending ? "Generating…" : "Generate prep"}
          </ChromePrimaryButton>
        </div>

        {appsQ.isError ? (
          <p className="mt-4 text-[13px] text-[var(--app-danger)]" role="alert">
            Could not load applications. Check your connection and try again.
          </p>
        ) : null}

        {prepM.isError ? (
          <p className="mt-4 text-[13px] text-[var(--app-danger)]" role="alert">
            {prepM.error instanceof Error ? prepM.error.message : "Prep failed."}
          </p>
        ) : null}

        {!appsQ.isLoading && sorted.length === 0 ? (
          <div className="mt-6 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/40 px-4 py-5 text-[13px] text-[var(--app-text-secondary)]">
            <p className="font-medium text-[var(--app-text-primary)]">No pipeline rows yet</p>
            <p className="mt-2 max-w-lg leading-relaxed">
              Prep is tied to real roles you&apos;ve started an application for. Start from{" "}
              <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                Discovery
              </Link>
              , generate outreach, then track progress on the{" "}
              <Link href="/app/tracker" className="font-medium text-[var(--app-accent)] underline-offset-4 hover:underline">
                Tracker
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Themes</h2>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--app-text-primary)]">
              {result.themes.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--app-accent)]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 lg:col-span-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Likely questions
            </h2>
            <ul className="mt-3 space-y-3">
              {result.suggested_questions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-[var(--app-radius-md)] border-[0.5px] border-[color-mix(in_srgb,var(--app-border)_80%,transparent)] bg-[var(--app-bg-page)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--app-text-primary)]"
                >
                  {q}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                Talking points & STAR starters
              </h2>
              <Tag>Grounded in your résumé</Tag>
            </div>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
              {result.talking_points.map((t, i) => (
                <li key={i} className="rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-accent)_08%,transparent)] px-3 py-2 text-[var(--app-text-primary)]">
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {!result && !prepM.isPending && selectedId && sorted.length > 0 ? (
        <p className="text-[13px] text-[var(--app-text-tertiary)]">
          Choose an application and tap <span className="font-medium text-[var(--app-text-secondary)]">Generate prep</span> to
          load role-specific interview guidance from the API.
        </p>
      ) : null}
    </ProductPageChrome>
  );
}
