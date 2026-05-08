import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/marketing/Container";

export const metadata: Metadata = {
  title: "Features",
  description: "What you get with DouBow: discovery, approvals, tracking, and prep.",
};

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-6">
      <div className="text-sm font-semibold tracking-tight">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)] text-pretty">{description}</p>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <main id="main" className="py-40">
      <Container>
        <div className="flex flex-col gap-4">
          <h1 className="font-[family-name:var(--font-display)] text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to run your job search like a project
          </h1>
          <p className="max-w-2xl text-pretty text-sm leading-6 text-[var(--muted)] sm:text-base">
            DouBow unifies discovery, scoring, drafting, approvals, tracking, and interview prep.
            Nothing is ever sent without explicit user approval—enforced at the API layer.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-14 w-[180px] items-center justify-center rounded-xl bg-[var(--accent)] px-8 text-base font-semibold text-black transition-transform active:scale-[0.96]"
            >
              Get started
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-14 w-[180px] items-center justify-center rounded-xl border border-[var(--border)] px-8 text-base font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-[0.96]"
            >
              View pricing
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Job discovery"
            description="Curated listings with filtering, sorting, and favorites."
          />
          <Feature
            title="Fit scoring"
            description="Structured rationale grounded in your résumé as source of truth."
          />
          <Feature
            title="Approval dashboard"
            description="Review drafts, edit inline, approve or reject—before anything is sent."
          />
          <Feature
            title="Application tracker"
            description="A state machine-backed pipeline: Applied → Interview → Offer."
          />
          <Feature
            title="Career Copilot"
            description="A contextual assistant for strategy, résumé review, and interview prep."
          />
          <Feature
            title="Auditability"
            description="Every LLM call logged with prompt, raw output, edits, and feedback."
          />
        </div>

        <div className="mt-14 grid gap-10 rounded-3xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] p-8 lg:grid-cols-2">
          <div>
            <div className="text-sm font-semibold tracking-tight">Human-in-the-loop enforcement</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] text-pretty">
              The submit endpoint returns{" "}
              <span className="font-semibold text-[var(--foreground)]">403</span> unless the database
              status is{" "}
              <span className="font-semibold text-[var(--foreground)]">APPROVED</span>. This is an
              architectural guarantee—not a UI checkbox.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-black/5 dark:bg-white/5 p-4">
              DISCOVERED → SCORING → DRAFTED
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-black/5 dark:bg-white/5 p-4">
              PENDING_APPROVAL → APPROVED → SUBMITTED
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}

