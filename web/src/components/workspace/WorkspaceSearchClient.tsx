"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/app-icon";
import { fetchApplications } from "@/lib/applications-fetch";
import { queryKeys } from "@/lib/query-keys";

import { ProductPageChrome } from "./ProductPageChrome";

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
};

type MilestoneRow = {
  id: string;
  title: string;
  status: string;
};

async function fetchJobs(): Promise<JobRow[]> {
  const r = await fetch("/api/jobs?limit=120&sort_by=created_at&order=desc", { cache: "no-store" });
  if (!r.ok) throw new Error("jobs");
  return (await r.json()) as JobRow[];
}

async function fetchMilestones(): Promise<MilestoneRow[]> {
  const r = await fetch("/api/me/milestones?limit=100", { cache: "no-store" });
  if (!r.ok) throw new Error("milestones");
  return (await r.json()) as MilestoneRow[];
}

export function WorkspaceSearchClient() {
  const [q, setQ] = useState("");
  const jobsQ = useQuery({ queryKey: ["workspace-search", "jobs"], queryFn: fetchJobs });
  const appsQ = useQuery({ queryKey: queryKeys.applications, queryFn: fetchApplications });
  const mileQ = useQuery({ queryKey: queryKeys.milestones, queryFn: fetchMilestones });

  const ql = q.trim().toLowerCase();

  const jobsHit = useMemo(() => {
    const rows = jobsQ.data ?? [];
    if (!ql) return rows.slice(0, 12);
    return rows
      .filter(
        (j) =>
          j.title.toLowerCase().includes(ql) ||
          j.company.toLowerCase().includes(ql) ||
          (j.location && j.location.toLowerCase().includes(ql)),
      )
      .slice(0, 36);
  }, [jobsQ.data, ql]);

  const appsHit = useMemo(() => {
    const rows = appsQ.data ?? [];
    if (!ql) return rows.slice(0, 10);
    return rows
      .filter(
        (a) =>
          a.job_title.toLowerCase().includes(ql) ||
          a.company.toLowerCase().includes(ql) ||
          a.status.toLowerCase().includes(ql),
      )
      .slice(0, 36);
  }, [appsQ.data, ql]);

  const mileHit = useMemo(() => {
    const rows = mileQ.data ?? [];
    if (!ql) return rows.slice(0, 10);
    return rows
      .filter((m) => m.title.toLowerCase().includes(ql) || m.status.toLowerCase().includes(ql))
      .slice(0, 24);
  }, [mileQ.data, ql]);

  const loading = jobsQ.isLoading || appsQ.isLoading || mileQ.isLoading;

  return (
    <ProductPageChrome
      title="Search"
      description="Fast client-side search across catalog jobs, your pipeline applications, and milestones. Results come from live API data — no separate search index."
    >
      <div className="relative">
        <AppIcon
          name="search"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--app-text-tertiary)]"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs, companies, applications, milestones…"
          className="h-12 w-full rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] pl-12 pr-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)]"
          autoComplete="off"
          aria-label="Workspace search"
        />
      </div>

      {loading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]" aria-busy="true">
          Loading catalog and pipeline…
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Jobs ({jobsHit.length}
            {!ql ? ` · ${jobsQ.data?.length ?? 0} loaded` : ""})
          </h2>
          <ul className="mt-3 space-y-2">
            {jobsHit.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/app/discovery/${j.id}`}
                  className="block rounded-[var(--app-radius-md)] border-[0.5px] border-transparent px-2 py-2 text-[13px] hover:border-[var(--app-border)] hover:bg-[var(--app-bg-muted)]"
                >
                  <span className="font-medium text-[var(--app-text-primary)]">{j.title}</span>
                  <span className="block text-[12px] text-[var(--app-text-secondary)]">
                    {j.company}
                    {j.location ? ` · ${j.location}` : ""}
                  </span>
                </Link>
              </li>
            ))}
            {jobsHit.length === 0 ? (
              <li className="text-[13px] text-[var(--app-text-tertiary)]">No catalog matches.</li>
            ) : null}
          </ul>
          <Link href="/app/discovery" className="mt-4 inline-block text-[13px] font-medium text-[var(--app-accent)] hover:underline">
            Open full Discovery →
          </Link>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Applications ({appsHit.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {appsHit.map((a) => (
              <li key={a.id}>
                <Link
                  href="/app/tracker"
                  className="block rounded-[var(--app-radius-md)] border-[0.5px] border-transparent px-2 py-2 text-[13px] hover:border-[var(--app-border)] hover:bg-[var(--app-bg-muted)]"
                >
                  <span className="font-medium text-[var(--app-text-primary)]">{a.job_title}</span>
                  <span className="block text-[12px] text-[var(--app-text-secondary)]">
                    {a.company} · {a.status.replaceAll("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
            {appsHit.length === 0 ? (
              <li className="text-[13px] text-[var(--app-text-tertiary)]">No pipeline matches.</li>
            ) : null}
          </ul>
          <Link href="/app/tracker" className="mt-4 inline-block text-[13px] font-medium text-[var(--app-accent)] hover:underline">
            Open Tracker →
          </Link>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Milestones ({mileHit.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {mileHit.map((m) => (
              <li key={m.id}>
                <Link
                  href="/app/career-steps"
                  className="block rounded-[var(--app-radius-md)] border-[0.5px] border-transparent px-2 py-2 text-[13px] hover:border-[var(--app-border)] hover:bg-[var(--app-bg-muted)]"
                >
                  <span className="font-medium text-[var(--app-text-primary)]">{m.title}</span>
                  <span className="block text-[12px] text-[var(--app-text-secondary)]">{m.status.replaceAll("_", " ")}</span>
                </Link>
              </li>
            ))}
            {mileHit.length === 0 ? (
              <li className="text-[13px] text-[var(--app-text-tertiary)]">No milestone matches.</li>
            ) : null}
          </ul>
          <Link href="/app/career-steps" className="mt-4 inline-block text-[13px] font-medium text-[var(--app-accent)] hover:underline">
            Open Career steps →
          </Link>
        </section>
      </div>
    </ProductPageChrome>
  );
}
