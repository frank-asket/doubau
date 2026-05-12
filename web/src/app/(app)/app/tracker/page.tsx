import type { Metadata } from "next";
import { Suspense } from "react";

import { TrackerClient } from "@/components/tracker/TrackerClient";

export const metadata: Metadata = {
  title: "Job Tracker",
};

export const dynamic = "force-dynamic";

export default function TrackerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[var(--app-content-max)] rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 text-[13px] text-[var(--app-text-secondary)]">
          Loading tracker…
        </div>
      }
    >
      <TrackerClient />
    </Suspense>
  );
}

