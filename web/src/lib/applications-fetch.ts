/** Shared REST helpers for `/api/applications*` — used by TanStack Query across Approval dashboard + Tracker. */

export type ApplicationRow = {
  id: string;
  company: string;
  job_title: string;
  status: string;
  source_url?: string | null;
};

export type DraftRow = {
  id: string;
  application_id: string;
  channel: string;
  content: string;
};

export async function fetchApplications(): Promise<ApplicationRow[]> {
  const r = await fetch("/api/applications", { cache: "no-store" });
  if (!r.ok) throw new Error("applications");
  return r.json() as Promise<ApplicationRow[]>;
}

export async function fetchDrafts(): Promise<DraftRow[]> {
  const r = await fetch("/api/applications/drafts", { cache: "no-store" });
  if (!r.ok) throw new Error("drafts");
  return r.json() as Promise<DraftRow[]>;
}
