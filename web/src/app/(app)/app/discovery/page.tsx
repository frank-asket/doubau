import type { Metadata } from "next";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import {
  DiscoveryClient,
  type CatalogSummary,
  type FeedRow,
  type JobRow,
} from "@/components/discovery/DiscoveryClient";

export const metadata: Metadata = {
  title: "Job Discovery",
};

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const base = getApiBaseUrl();

  let feed: FeedRow[] = [];
  let jobs: JobRow[] = [];
  let hidden: JobRow[] = [];
  let catalogSummary: CatalogSummary | null = null;
  let resumeStatus: string | null = null;
  let loadError = false;

  try {
    const headers = await getBackendAuthHeaders();
    const [feedRes, jobsRes, hiddenRes, summaryRes, workspaceRes] = await Promise.all([
      fetch(`${base}/jobs/feed?limit=50`, { headers, cache: "no-store" }),
      fetch(`${base}/jobs?limit=50&sort_by=created_at&order=desc`, { headers, cache: "no-store" }),
      fetch(`${base}/jobs/hidden?limit=50`, { headers, cache: "no-store" }),
      fetch(`${base}/jobs/catalog/summary`, { headers, cache: "no-store" }),
      fetch(`${base}/me/workspace-summary`, { headers, cache: "no-store" }),
    ]);

    feed = feedRes.ok ? ((await feedRes.json()) as FeedRow[]) : [];
    jobs = jobsRes.ok ? ((await jobsRes.json()) as JobRow[]) : [];
    hidden = hiddenRes.ok ? ((await hiddenRes.json()) as JobRow[]) : [];
    catalogSummary = summaryRes.ok ? ((await summaryRes.json()) as CatalogSummary) : null;
    if (workspaceRes.ok) {
      const ws = (await workspaceRes.json()) as { resume_status?: string | null };
      resumeStatus = ws.resume_status ?? null;
    }
    loadError = !feedRes.ok || !jobsRes.ok || !hiddenRes.ok || !summaryRes.ok;
  } catch {
    /* ECONNREFUSED etc. when API is down — render UI with empty lists instead of RSC 500 */
    loadError = true;
  }

  return (
    <DiscoveryClient
      initialFeed={feed}
      initialJobs={jobs}
      initialHiddenJobs={hidden}
      catalogSummary={catalogSummary}
      resumeStatus={resumeStatus}
      loadError={loadError}
    />
  );
}
