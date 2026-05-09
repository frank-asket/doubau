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

  const [feedRes, jobsRes, hiddenRes] = await Promise.all([
    fetch(`${base}/jobs/feed?limit=50`, { headers, cache: "no-store" }),
    fetch(`${base}/jobs?limit=50&sort_by=created_at&order=desc`, { headers, cache: "no-store" }),
    fetch(`${base}/jobs/hidden?limit=50`, { headers, cache: "no-store" }),
  ]);

  const feed = feedRes.ok ? ((await feedRes.json()) as FeedRow[]) : [];
  const jobs = jobsRes.ok ? ((await jobsRes.json()) as JobRow[]) : [];
  const hidden = hiddenRes.ok ? ((await hiddenRes.json()) as JobRow[]) : [];

  return (
    <DiscoveryClient
      initialFeed={feed}
      initialJobs={jobs}
      initialHiddenJobs={hidden}
      loadError={!feedRes.ok || !jobsRes.ok || !hiddenRes.ok}
    />
  );
}
