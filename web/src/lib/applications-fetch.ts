/** Shared REST helpers for `/api/applications*` — used by TanStack Query across Approval dashboard + Tracker. */

export type ApplicationRow = {
  id: string;
  company: string;
  job_title: string;
  status: string;
  source_url?: string | null;
  recipient_email?: string | null;
  gmail_sent_message_id?: string | null;
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  notes?: string | null;
  next_followup_at?: string | null;
  tags?: string[] | null;
};

export type ApplicationDetailRow = ApplicationRow & {
  job_description_excerpt?: string | null;
};

export type DraftRow = {
  id: string;
  application_id: string;
  channel: string;
  content: string;
  status?: string;
};

export async function fetchApplications(): Promise<ApplicationRow[]> {
  const r = await fetch("/api/applications", { cache: "no-store" });
  if (!r.ok) throw new Error("applications");
  return (await r.json()) as ApplicationRow[];
}

export async function fetchApplicationDetail(id: string): Promise<ApplicationDetailRow> {
  const r = await fetch(`/api/applications/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("application");
  return (await r.json()) as ApplicationDetailRow;
}

export type ApplicationPatchBody = {
  notes?: string | null;
  next_followup_at?: string | null;
  tags?: string[] | null;
};

export async function patchApplication(id: string, body: ApplicationPatchBody): Promise<ApplicationRow> {
  const r = await fetch(`/api/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not save tracker fields.");
  }
  return (await r.json()) as ApplicationRow;
}

export async function createApplication(body: {
  company: string;
  job_title: string;
  source_url?: string | null;
}): Promise<ApplicationRow> {
  const r = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not add application.");
  }
  return (await r.json()) as ApplicationRow;
}

export async function fetchDrafts(): Promise<DraftRow[]> {
  const r = await fetch("/api/applications/drafts", { cache: "no-store" });
  if (!r.ok) throw new Error("drafts");
  return (await r.json()) as DraftRow[];
}

/** Gmail web client: open a message by the id returned from ``users.messages.send``. */
export function gmailSentMessageWebUrl(messageId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(messageId)}`;
}
