import type { Metadata } from "next";

import { MatchAnalyticsClient } from "@/components/analytics/MatchAnalyticsClient";

export const metadata: Metadata = {
  title: "Match analytics",
};

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Match analytics
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          Live counts from your discovery feed: impressions, clicks, and feedback. Use this to spot friction
          before it shows up in interviews.
        </p>
      </div>
      <MatchAnalyticsClient />
    </div>
  );
}
