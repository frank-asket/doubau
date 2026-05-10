import type { Metadata } from "next";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import { DiscoveryClient, type FeedRow, type JobRow } from "@/components/discovery/DiscoveryClient";

export const metadata: Metadata = {
  title: "Job Discovery",
};

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const base = getApiBaseUrl();
  const headers = await getBackendAuthHeaders();

  let feed: FeedRow[] = [];
  let jobs: JobRow[] = [];
  let hidden: JobRow[] = [];
  let loadError = false;

  try {
    const [feedRes, jobsRes, hiddenRes] = await Promise.all([
      fetch(`${base}/jobs/feed?limit=50`, { headers, cache: "no-store" }),
      fetch(`${base}/jobs?limit=50&sort_by=created_at&order=desc`, { headers, cache: "no-store" }),
      fetch(`${base}/jobs/hidden?limit=50`, { headers, cache: "no-store" }),
    ]);

    feed = feedRes.ok ? ((await feedRes.json()) as FeedRow[]) : [];
    jobs = jobsRes.ok ? ((await jobsRes.json()) as JobRow[]) : [];
    hidden = hiddenRes.ok ? ((await hiddenRes.json()) as JobRow[]) : [];
    loadError = !feedRes.ok || !jobsRes.ok || !hiddenRes.ok;
  } catch {
    /* ECONNREFUSED etc. when API is down — render UI with empty lists instead of RSC 500 */
    loadError = true;
  }

  return (
    <DiscoveryClient
      initialFeed={feed}
      initialJobs={jobs}
      initialHiddenJobs={hidden}
      loadError={loadError}
    />
  );
}
