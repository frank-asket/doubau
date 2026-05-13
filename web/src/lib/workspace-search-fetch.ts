import { fetchApplications, type ApplicationRow } from "@/lib/applications-fetch";

export type WorkspaceSearchJobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
};

export type WorkspaceSearchMilestoneRow = {
  id: string;
  title: string;
  status: string;
};

export async function fetchWorkspaceSearchJobs(): Promise<WorkspaceSearchJobRow[]> {
  const r = await fetch("/api/jobs?limit=120&sort_by=created_at&order=desc", { cache: "no-store" });
  if (!r.ok) throw new Error("jobs");
  return (await r.json()) as WorkspaceSearchJobRow[];
}

export async function fetchWorkspaceSearchMilestones(): Promise<WorkspaceSearchMilestoneRow[]> {
  const r = await fetch("/api/me/milestones?limit=100", { cache: "no-store" });
  if (!r.ok) throw new Error("milestones");
  return (await r.json()) as WorkspaceSearchMilestoneRow[];
}

export async function fetchWorkspaceSearchApplications(): Promise<ApplicationRow[]> {
  return fetchApplications();
}

export type MatchEventRow = {
  id: string;
  job_id: string;
  event_type: string;
  reason?: string | null;
  created_at: string;
};

export async function fetchMatchEvents(): Promise<MatchEventRow[]> {
  const r = await fetch("/api/me/match/events?limit=50", { cache: "no-store" });
  if (!r.ok) throw new Error("match-events");
  return (await r.json()) as MatchEventRow[];
}
