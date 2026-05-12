"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { AppButton } from "@/components/ui/button";

import { ProductPageChrome } from "./ProductPageChrome";

const STORAGE_KEY = "doubow-demo-milestone-checks-v1";

export type DemoStep = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "resume",
    title: "Résumé parsed",
    detail: "Upload a CV from the dashboard and wait until status is parsed — everything downstream depends on it.",
    href: "/app/dashboard",
  },
  {
    id: "discovery",
    title: "Catalog & scores",
    detail: "Open Discovery and confirm you see roles with fit scores (feed jobs require ingest/workers in production).",
    href: "/app/discovery",
  },
  {
    id: "role",
    title: "Pick a role",
    detail: "Open a job detail, skim the posting, and optionally generate outreach when ready.",
    href: "/app/discovery",
  },
  {
    id: "draft",
    title: "Draft outreach",
    detail: "From the job page or tracker, generate outreach — drafts land in the approval queue.",
    href: "/app/approvals",
  },
  {
    id: "approve",
    title: "Approval gate",
    detail: "Edit if needed, approve the draft — nothing sends until you explicitly approve (server-enforced).",
    href: "/app/approvals",
  },
  {
    id: "tracker",
    title: "Pipeline visibility",
    detail: "Use the tracker to see statuses end-to-end; submit when you are ready after approval.",
    href: "/app/tracker",
  },
  {
    id: "prep",
    title: "Interview prep",
    detail: "Pick an application on Interview prep and generate prep grounded in résumé + job context.",
    href: "/app/interview-prep",
  },
];

function loadChecks(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function DemoMilestoneClient() {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  useEffect(() => {
    setChecks(loadChecks());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (!cancelled) setHealth(j);
      })
      .catch((e) => {
        if (!cancelled) setHealthErr(e instanceof Error ? e.message : "Health check failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: string) => {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setChecks({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const doneCount = DEMO_STEPS.filter((s) => checks[s.id]).length;

  return (
    <ProductPageChrome
      title="Demo milestone"
      description="Walk this path once in staging or production to validate résumé → discovery → drafts → approvals → tracker → interview prep. Check boxes are stored only in this browser."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3">
        <p className="text-[13px] text-[var(--app-text-secondary)]">
          Progress:{" "}
          <span className="font-semibold tabular-nums text-[var(--app-text-primary)]">
            {doneCount}/{DEMO_STEPS.length}
          </span>
        </p>
        <AppButton type="button" variant="outline" size="sm" onClick={resetAll}>
          Reset checklist
        </AppButton>
      </div>

      <ol className="mt-6 space-y-3">
        {DEMO_STEPS.map((step, i) => {
          const checked = Boolean(checks[step.id]);
          return (
            <li
              key={step.id}
              className={`rounded-[var(--app-radius-lg)] border-[0.5px] border-solid px-4 py-4 sm:px-5 ${
                checked
                  ? "border-[color-mix(in_srgb,var(--app-accent)_45%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_06%,transparent)]"
                  : "border-[var(--app-border)] bg-[var(--app-bg-elevated)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border-[0.5px] border-solid text-[12px] font-bold transition-colors ${
                      checked
                        ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
                        : "border-[var(--app-border)] bg-[var(--app-bg-page)] text-[var(--app-text-tertiary)] hover:border-[var(--app-accent)]"
                    }`}
                    aria-pressed={checked}
                    aria-label={checked ? `Mark step ${i + 1} incomplete` : `Mark step ${i + 1} done`}
                  >
                    {checked ? "✓" : i + 1}
                  </button>
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--app-text-primary)]">{step.title}</h2>
                    <p className="mt-1 max-w-2xl text-pretty text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
                      {step.detail}
                    </p>
                  </div>
                </div>
                <Link
                  href={step.href}
                  className="inline-flex shrink-0 items-center gap-1 self-start rounded-[var(--app-radius-pill)] bg-[var(--app-bg-muted)] px-3 py-2 text-[13px] font-medium text-[var(--app-accent)] hover:underline sm:self-center"
                >
                  Open <AppIcon name="chevron-right" className="size-4" />
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-10 rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-muted)]/30 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Deployment probe
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
          Uses <code className="rounded bg-[var(--app-bg-elevated)] px-1.5 py-0.5 text-[12px]">GET /api/health</code> on this
          Next app and forwards to the FastAPI{" "}
          <code className="rounded bg-[var(--app-bg-elevated)] px-1.5 py-0.5 text-[12px]">/health</code> endpoint (via{" "}
          <code className="rounded bg-[var(--app-bg-elevated)] px-1.5 py-0.5 text-[12px]">NEXT_PUBLIC_API_BASE_URL</code>
          ).
        </p>
        {healthErr ? (
          <p className="mt-3 text-[13px] text-[var(--app-danger)]" role="alert">
            {healthErr}
          </p>
        ) : null}
        {health ? (
          <pre className="mt-4 max-h-48 overflow-auto rounded-[var(--app-radius-md)] bg-[var(--app-bg-page)] p-3 text-[11px] leading-relaxed text-[var(--app-text-secondary)]">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : !healthErr ? (
          <p className="mt-3 text-[13px] text-[var(--app-text-tertiary)]">Loading…</p>
        ) : null}
      </section>
    </ProductPageChrome>
  );
}
