/** Shared REST helpers for `/api/applications*` — used by TanStack Query across Approval dashboard + Tracker. */

export type ApplicationRow = {
  id: string;
  company: string;
  job_title: string;
  status: string;
  source_url?: string | null;
  recipient_email?: string | null;
  gmail_sent_message_id?: string | null;
  created_at?: string;
  updated_at?: string;
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

export async function fetchDrafts(): Promise<DraftRow[]> {
  const r = await fetch("/api/applications/drafts", { cache: "no-store" });
  if (!r.ok) throw new Error("drafts");
  return (await r.json()) as DraftRow[];
}

/** Gmail web client: open a message by the id returned from ``users.messages.send``. */
export function gmailSentMessageWebUrl(messageId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(messageId)}`;
}
