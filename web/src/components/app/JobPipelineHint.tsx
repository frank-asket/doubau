"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type Variant = "discovery" | "job" | "approvals" | "dashboard";

type StepKey = "discovery" | "job" | "draft" | "approvals";

const STEPS: { key: StepKey; n: number; label: string }[] = [
  { key: "discovery", n: 1, label: "Discover" },
  { key: "job", n: 2, label: "Role" },
  { key: "draft", n: 3, label: "Draft" },
  { key: "approvals", n: 4, label: "Approve" },
];

function activeStepFor(variant: Variant): number | null {
  if (variant === "discovery") return 1;
  if (variant === "job") return 2;
  if (variant === "approvals") return 4;
  return null;
}

export function JobPipelineHint({ variant }: { variant: Variant }) {
  const active = activeStepFor(variant);

  return (
    <nav
      aria-label={variant === "dashboard" ? "Main job loop" : "Job search flow"}
      className="flex flex-wrap items-center gap-1 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-2.5 sm:gap-2 sm:px-4"
    >
      <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)] sm:mr-2">
        Flow
      </span>
      {STEPS.map((s, i) => {
        const isActive = active !== null && s.n === active;
        const isPast = active !== null && s.n < active;
        const showChevron = i < STEPS.length - 1;

        const inner = (
          <span
            className={`inline-flex min-h-8 items-center rounded-[var(--app-radius-pill)] px-2.5 py-1 text-[12px] font-medium sm:px-3 ${
              isActive
                ? "bg-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] text-[var(--app-text-primary)] ring-1 ring-[color-mix(in_srgb,var(--app-accent)_45%,transparent)]"
                : isPast
                  ? "text-[var(--app-text-secondary)]"
                  : "text-[var(--app-text-tertiary)]"
            }`}
          >
            <span className="tabular-nums opacity-70">{s.n}.</span>
            <span className="ml-1">{s.label}</span>
          </span>
        );

        let node: ReactNode = inner;

        if (s.key === "discovery" && variant !== "discovery") {
          node = (
            <Link href="/app/discovery" className="transition-colors hover:text-[var(--app-accent)]">
              {inner}
            </Link>
          );
        }
        if (s.key === "approvals" && variant !== "approvals") {
          node = (
            <Link href="/app/approvals" className="transition-colors hover:text-[var(--app-accent)]">
              {inner}
            </Link>
          );
        }

        return (
          <span key={s.n} className="flex flex-wrap items-center gap-1 sm:gap-2">
            {node}
            {showChevron ? (
              <span aria-hidden className="text-[11px] text-[var(--app-text-tertiary)] sm:text-[12px]">
                →
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
