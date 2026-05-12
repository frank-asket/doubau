"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app segment error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-[var(--app-radius-lg)] border border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_08%,var(--app-bg-elevated))] p-6 text-[var(--app-text-primary)]">
      <h1 className="text-[18px] font-semibold">Something went wrong</h1>
      <p className="text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
        This workspace view failed to render. You can retry or go back to the dashboard.
      </p>
      {error.digest ? (
        <p className="font-mono text-[11px] text-[var(--app-text-tertiary)]">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 text-[13px] font-medium text-white hover:bg-[var(--app-accent-hover)]"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link
          href="/app/dashboard"
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-4 text-[13px] font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-bg-muted)]"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
