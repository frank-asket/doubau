"use client";

import { useEffect, useMemo, useState } from "react";

type Application = {
  id: string;
  company: string;
  job_title: string;
  status: string;
};

type Draft = {
  id: string;
  application_id: string;
  channel: string;
  content: string;
};

export default function ApprovalsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appById = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const [appsResp, draftsResp] = await Promise.all([
        fetch("/api/applications", { cache: "no-store" }),
        fetch("/api/applications/drafts", { cache: "no-store" }),
      ]);
      if (!appsResp.ok || !draftsResp.ok) {
        setError("Failed to load approvals data.");
        return;
      }
      setApps(await appsResp.json());
      setDrafts(await draftsResp.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDemo() {
    setError(null);
    setLoading(true);
    try {
      const created = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: "Acme", job_title: "Product Manager" }),
      });
      if (!created.ok) {
        setError("Failed to create demo application.");
        return;
      }
      const app: Application = await created.json();
      await fetch(`/api/applications/${app.id}/generate_draft`, { method: "POST" });
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function approve(appId: string) {
    setError(null);
    const resp = await fetch(`/api/applications/${appId}/approve`, { method: "POST" });
    if (!resp.ok) {
      setError("Approve failed.");
      return;
    }
    await refresh();
  }

  async function submit(appId: string) {
    setError(null);
    const resp = await fetch(`/api/applications/${appId}/submit`, { method: "POST" });
    if (!resp.ok) {
      const data = (await resp.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? "Submit failed (server enforced).");
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Review drafts, approve them, then submit. The backend blocks submit unless status is
            APPROVED.
          </p>
        </div>

        <button
          onClick={createDemo}
          disabled={loading}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-[0.96] disabled:opacity-60"
        >
          Create demo draft
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] p-6 text-sm text-[var(--muted)]">
            No drafts yet. Create a demo draft to see the approval gate.
          </div>
        ) : (
          drafts.map((d) => {
            const app = appById.get(d.application_id);
            return (
              <div key={d.id} className="rounded-2xl border border-[var(--border)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold tracking-tight">
                      {app ? `${app.job_title} · ${app.company}` : d.application_id}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Channel: {d.channel} · Status: {app?.status ?? "—"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(d.application_id)}
                      className="rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition-transform active:scale-[0.96]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => submit(d.application_id)}
                      className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-[0.96]"
                    >
                      Submit
                    </button>
                  </div>
                </div>

                <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-black/5 dark:bg-white/5 p-4 text-xs leading-5">
                  {d.content}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

