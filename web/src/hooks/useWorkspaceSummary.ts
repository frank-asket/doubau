"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export type WorkspaceSummary = {
  email: string;
  persona: string | null;
  current_role: string | null;
  location: string | null;
  plan_tier: string | null;
  resume_status: string | null;
  resume_id: string | null;
  applications_total: number;
  applications_by_status: Record<string, number>;
  pending_approval_count: number;
};

export function useWorkspaceSummary() {
  return useQuery({
    queryKey: queryKeys.workspaceSummary,
    queryFn: async (): Promise<WorkspaceSummary> => {
      const r = await fetch("/api/me/workspace/summary", { cache: "no-store" });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `Summary failed (${r.status})`);
      }
      return (await r.json()) as WorkspaceSummary;
    },
  });
}
