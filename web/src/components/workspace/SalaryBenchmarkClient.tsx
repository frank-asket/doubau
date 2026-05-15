"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ChromePrimaryButton } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";
import type { ProfileDto } from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type FeedRow = {
  job: {
    company: string;
    title: string;
    location: string | null;
    seniority: string | null;
    employment_type: string | null;
    tags: string[];
    description: string | null;
  };
  score: number;
};

type MatchEvent = {
  created_at: string;
};

type SalaryLookupState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: unknown; error: null }
  | { status: "error"; data: null; error: string };

function weekKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const days = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  const week = Math.floor(days / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findSalaryRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSalaryRecord(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).map((k) => k.toLowerCase());
  if (keys.some((k) => k.includes("salary") || k.includes("compensation"))) return value;
  for (const item of Object.values(value)) {
    const found = findSalaryRecord(item);
    if (found) return found;
  }
  return null;
}

function formatSalaryValue(value: unknown, currency?: string): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const prefix = currency ? `${currency} ` : "";
    return `${prefix}${Math.round(value).toLocaleString()}`;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function salaryBands(data: unknown) {
  const record = findSalaryRecord(data);
  if (!record) return [];
  const currency =
    typeof record.salary_currency === "string"
      ? record.salary_currency
      : typeof record.currency === "string"
        ? record.currency
        : undefined;
  const candidates = [
    ["Median", record.salary_median ?? record.median_salary ?? record.median_base_salary],
    ["Minimum", record.salary_min ?? record.min_salary ?? record.min_base_salary],
    ["Maximum", record.salary_max ?? record.max_salary ?? record.max_base_salary],
    ["Average", record.average_salary ?? record.avg_salary],
  ];
  return candidates
    .map(([label, value]) => ({ label: String(label), value: formatSalaryValue(value, currency) }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value));
}

export function SalaryBenchmarkClient() {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [years, setYears] = useState("");
  const [skillsNote, setSkillsNote] = useState("");
  const [salaryLookup, setSalaryLookup] = useState<SalaryLookupState>({
    status: "idle",
    data: null,
    error: null,
  });
  const profileHydrated = useRef(false);

  const profileQ = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return (await r.json()) as ProfileDto;
    },
  });

  useEffect(() => {
    const p = profileQ.data;
    if (!p || profileHydrated.current) return;
    profileHydrated.current = true;
    if (typeof p.current_role === "string") setRole(p.current_role);
    if (typeof p.location === "string") setLocation(p.location);
    if (typeof p.years_experience === "string") setYears(p.years_experience);
  }, [profileQ.data]);

  const feedQ = useQuery({
    queryKey: queryKeys.jobsFeed(40),
    queryFn: async () => {
      const r = await fetch("/api/jobs/feed?limit=40", { cache: "no-store" });
      if (!r.ok) throw new Error("feed");
      return (await r.json()) as FeedRow[];
    },
  });

  const eventsQ = useQuery({
    queryKey: queryKeys.matchEvents,
    queryFn: async () => {
      const r = await fetch("/api/me/match/events?limit=400", { cache: "no-store" });
      if (!r.ok) throw new Error("events");
      return (await r.json()) as MatchEvent[];
    },
  });

  const topCompanies = useMemo(() => {
    const rows = feedQ.data ?? [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const c = row.job.company?.trim() || "Unknown";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, n]) => ({ name, n }));
  }, [feedQ.data]);

  const chartPoints = useMemo(() => {
    const events = eventsQ.data ?? [];
    const byWeek = new Map<string, number>();
    for (const ev of events) {
      const k = weekKey(ev.created_at);
      if (!k) continue;
      byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
    }
    const keys = [...byWeek.keys()].sort((a, b) => a.localeCompare(b));
    const last = keys.slice(-12);
    const vals = last.map((k) => byWeek.get(k) ?? 0);
    const max = Math.max(1, ...vals);
    return vals.map((v) => Math.round((v / max) * 100));
  }, [eventsQ.data]);

  const pick = feedQ.data?.[0]?.job;
  const bands = salaryLookup.status === "success" ? salaryBands(salaryLookup.data) : [];

  async function submitSalaryLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = role.trim();
    if (!title) {
      setSalaryLookup({ status: "error", data: null, error: "Add a job title before running the benchmark." });
      return;
    }
    const qs = new URLSearchParams({ job_title: title });
    if (location.trim()) qs.set("location", location.trim());
    if (years.trim()) qs.set("years_of_experience", years.trim());
    setSalaryLookup({ status: "loading", data: null, error: null });
    try {
      const r = await fetch(`/api/integrations/glassdoor/salaries?${qs.toString()}`, {
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = isRecord(body) && typeof body.detail === "string" ? body.detail : "Salary lookup failed.";
        throw new Error(detail);
      }
      setSalaryLookup({ status: "success", data: body, error: null });
    } catch (err) {
      setSalaryLookup({
        status: "error",
        data: null,
        error: err instanceof Error ? err.message : "Salary lookup failed.",
      });
    }
  }

  return (
    <ProductPageChrome
      title="Salary Benchmark"
      description="Live Glassdoor Real-time salary and company context through RapidAPI, cached per role and location for 24 hours."
    >
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Discovery activity</h2>
            <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">
              Weekly match-event volume (proxy for search intensity — not compensation).
            </p>
            <div className="relative mt-8 h-80">
              <div className="absolute inset-x-0 top-1/2 border-t border-dotted border-[var(--app-text-secondary)]" />
              {chartPoints.length > 0 ? (
                <svg className="h-full w-full overflow-visible" viewBox="0 0 720 260" preserveAspectRatio="none" aria-label="Activity trend">
                  <polyline
                    fill="none"
                    stroke="var(--app-accent)"
                    strokeWidth="4"
                    points={chartPoints.map((p, i) => {
                      const xSpan = Math.max(1, chartPoints.length - 1);
                      return `${(i / xSpan) * 720},${250 - p * 2.4}`;
                    }).join(" ")}
                  />
                  {chartPoints.map((p, i) => {
                    const xSpan = Math.max(1, chartPoints.length - 1);
                    return (
                      <circle
                        key={`${p}-${i}`}
                        cx={(i / xSpan) * 720}
                        cy={250 - p * 2.4}
                        r="7"
                        fill="var(--app-accent)"
                        stroke="white"
                        strokeWidth="3"
                      />
                    );
                  })}
                </svg>
              ) : (
                <p className="py-16 text-center text-[13px] text-[var(--app-text-secondary)]">
                  Log discovery interactions to see a trend — no events yet.
                </p>
              )}
            </div>
          </section>

          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Companies in your feed</h2>
            <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">
              Ranked by frequency in your current ranked discovery results (not median pay).
            </p>
            {feedQ.isLoading ? (
              <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">Loading feed…</p>
            ) : topCompanies.length === 0 ? (
              <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">
                Empty feed — open{" "}
                <Link href="/app/discovery" className="font-medium text-[var(--app-accent)] hover:underline">
                  Job discovery
                </Link>
                .
              </p>
            ) : (
              topCompanies.map(({ name, n }) => (
                <article key={name} className="mt-5 border-b border-dashed border-[var(--app-border)] pb-5 last:border-0">
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-bold">{name}</h3>
                      <p className="mt-2 text-[15px] text-[var(--app-text-primary)]">{n} ranked roles in sample</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <form className="ch-panel p-6" onSubmit={submitSalaryLookup}>
            <h2 className="text-[20px] font-bold">Role context</h2>
            <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">
              Benchmarks call Glassdoor Real-time on demand through RapidAPI and reuse the same title/location result for 24 hours.
            </p>
            <label className="mt-6 block font-semibold">
              Job title
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-3 h-12 w-full rounded-full border border-[var(--app-border)] px-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
                placeholder="e.g. Software Engineer"
              />
            </label>
            <label className="mt-6 block font-semibold">
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-3 h-12 w-full rounded-full border border-[var(--app-border)] px-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
                placeholder="City / region"
              />
            </label>
            <label className="mt-6 block font-semibold">
              Years of experience
              <input
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="mt-3 h-12 w-full rounded-full border border-[var(--app-border)] px-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
                placeholder="e.g. 5+ years"
              />
            </label>
            <label className="mt-6 block font-semibold">
              Skills & notes (optional)
              <input
                value={skillsNote}
                onChange={(e) => setSkillsNote(e.target.value)}
                className="mt-3 h-12 w-full rounded-full border border-[var(--app-border)] px-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]"
                placeholder="Keywords you negotiate with"
              />
            </label>
            <ChromePrimaryButton type="submit" className="mt-7 w-full" disabled={salaryLookup.status === "loading"}>
              <AppIcon name="analytics" className="size-5" />{" "}
              {salaryLookup.status === "loading" ? "Checking RapidAPI…" : "Predict salary"}
            </ChromePrimaryButton>

            {salaryLookup.status === "error" ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {salaryLookup.error}
              </p>
            ) : null}

            {salaryLookup.status === "success" ? (
              <div className="mt-5 rounded-md border border-[var(--app-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[14px] font-bold">Live salary signal</h3>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
                    24h cached
                  </span>
                </div>
                {bands.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {bands.slice(0, 3).map((band) => (
                      <div key={band.label} className="rounded-md bg-[var(--app-bg-muted)] px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase text-[var(--app-text-tertiary)]">{band.label}</p>
                        <p className="mt-1 text-[17px] font-bold text-[var(--app-text-primary)]">{band.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-[var(--app-text-secondary)]">
                    RapidAPI returned salary data, but this provider response shape did not expose a standard min / median / max field.
                  </p>
                )}
              </div>
            ) : null}
          </form>

          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Top discovery pick</h2>
            {pick ? (
              <article className="ch-soft-card mt-5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[var(--app-text-primary)]">{pick.title}</h3>
                    <p className="mt-1 text-[13px] font-semibold text-[var(--app-accent)]">{pick.company}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {pick.seniority ? <Tag>{pick.seniority}</Tag> : null}
                  {pick.employment_type ? <Tag>{pick.employment_type}</Tag> : null}
                  {pick.location ? <Tag>{pick.location}</Tag> : null}
                </div>
                <p className="mt-4 text-[14px] leading-5 text-[var(--app-text-primary)]">
                  {(pick.description ?? "").slice(0, 220)}
                  {(pick.description ?? "").length > 220 ? "…" : ""}
                </p>
                <p className="mt-5 text-[13px] text-[var(--app-text-tertiary)]">
                  Use this role as a quick input for the live salary predictor above.
                </p>
              </article>
            ) : (
              <p className="mt-5 text-[13px] text-[var(--app-text-secondary)]">No feed rows yet.</p>
            )}
          </section>
        </aside>
      </div>
    </ProductPageChrome>
  );
}
