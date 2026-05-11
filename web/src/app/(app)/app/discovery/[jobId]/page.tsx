import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import { JobDetailClient } from "@/components/discovery/JobDetailClient";
import type { JobRow } from "@/components/discovery/DiscoveryClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params;
  let title = "Job details";
  try {
    const base = getApiBaseUrl();
    const headers = await getBackendAuthHeaders();
    const res = await fetch(`${base}/jobs/${jobId}`, { headers, cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as JobRow;
      title = `${j.title} · ${j.company}`;
    }
  } catch {
    /* ignore */
  }
  return { title };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { jobId } = await params;
  try {
    const base = getApiBaseUrl();
    const headers = await getBackendAuthHeaders();
    const res = await fetch(`${base}/jobs/${jobId}`, { headers, cache: "no-store" });
    if (res.status === 404) notFound();
    if (!res.ok) notFound();
    const job = (await res.json()) as JobRow;
    return <JobDetailClient job={job} />;
  } catch {
    notFound();
  }
}
