"use client";

import Link from "next/link";

import { useWorkspaceSummary } from "@/hooks/useWorkspaceSummary";

import { WorkspaceInsightsPanel } from "./WorkspaceInsightsPanel";
import { ProductPageChrome } from "./ProductPageChrome";

export function PlannerPageClient() {
  const q = useWorkspaceSummary();

  return (
    <ProductPageChrome
      title="Career planner"
      description="Prioritize what to do next using live counts from your DouBow workspace — résumé readiness, pipeline depth, and approvals backlog."
    >
      <WorkspaceInsightsPanel intro="These signals refresh from GET /me/workspace-summary via the Next.js BFF." />

      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Suggested order
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Clear pending approvals{" "}
            {q.data && q.data.pending_approval_count > 0 ? (
              <Link href="/app/approvals" className="font-medium text-[var(--app-accent)] hover:underline">
                ({q.data.pending_approval_count} waiting)
              </Link>
            ) : (
              "(none right now)"
            )}
          </li>
          <li>
            Refresh matches in{" "}
            <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] hover:underline">
              Job discovery
            </Link>
          </li>
          <li>
            Track outcomes in the{" "}
            <Link href="/app/tracker" className="font-medium text-[var(--app-accent)] hover:underline">
              tracker
            </Link>
          </li>
        </ol>
      </div>
    </ProductPageChrome>
  );
}
