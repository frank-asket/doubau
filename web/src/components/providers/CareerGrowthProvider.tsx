"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { queryKeys } from "@/lib/query-keys";

const CAREER_PREFIXES = [
  "/app/career-profile",
  "/app/career-steps",
  "/app/pathfinder",
  "/app/planner",
  "/app/career-success",
  "/app/career-health",
  "/app/salary-benchmark",
  "/app/linkedin-analysis",
  "/app/sponsorship-hub",
] as const;

export function isCareerGrowthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return CAREER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

async function fetchResumeLatest(): Promise<unknown | null> {
  const r = await fetch("/api/me/resume/latest", { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("resume");
  return r.json();
}

export type CareerGrowthContextValue = {
  /** Warms React Query cache for all Career growth screens (profile, milestones, feed, …). */
  prefetchCareerBundle: () => Promise<void>;
  /** True when the current route is under Career growth IA. */
  isCareerRoute: boolean;
};

const CareerGrowthContext = createContext<CareerGrowthContextValue | null>(null);

const defaultValue: CareerGrowthContextValue = {
  prefetchCareerBundle: async () => {},
  isCareerRoute: false,
};

/** Safe outside `CareerGrowthProvider` (returns no-op). */
export function useCareerGrowthOptional(): CareerGrowthContextValue {
  return useContext(CareerGrowthContext) ?? defaultValue;
}

/** Prefer inside `(app)/app` shell — falls back to no-op if provider missing. */
export function useCareerGrowth(): CareerGrowthContextValue {
  return useCareerGrowthOptional();
}

export function CareerGrowthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const onCareer = useMemo(() => isCareerGrowthPath(pathname), [pathname]);

  const prefetchCareerBundle = useCallback(async () => {
    await Promise.allSettled([
      qc.prefetchQuery({
        queryKey: queryKeys.profile,
        queryFn: () => fetchJson("/api/me/profile"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.workspaceSummary,
        queryFn: () => fetchJson("/api/me/workspace/summary"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.resumeLatest,
        queryFn: fetchResumeLatest,
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.milestones,
        queryFn: () => fetchJson("/api/me/milestones?limit=200"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.checkIns,
        queryFn: () => fetchJson("/api/me/check-ins?limit=120"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.matchMetrics(30),
        queryFn: () => fetchJson("/api/me/match/metrics?days=30"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.matchEvents,
        queryFn: () => fetchJson("/api/me/match/events?limit=400"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.jobsFeed(40),
        queryFn: () => fetchJson("/api/jobs/feed?limit=40"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.jobsFeed(80),
        queryFn: () => fetchJson("/api/jobs/feed?limit=80"),
      }),
    ]);
  }, [qc]);

  useEffect(() => {
    if (!onCareer) return;
    void prefetchCareerBundle();
  }, [onCareer, pathname, prefetchCareerBundle]);

  const value = useMemo<CareerGrowthContextValue>(
    () => ({
      prefetchCareerBundle,
      isCareerRoute: onCareer,
    }),
    [prefetchCareerBundle, onCareer],
  );

  return <CareerGrowthContext.Provider value={value}>{children}</CareerGrowthContext.Provider>;
}

/** Sidebar: throttle hover prefetch so rapid moves don’t spam the API. */
export function useCareerGrowthHoverPrefetch(cooldownMs = 2500) {
  const { prefetchCareerBundle } = useCareerGrowthOptional();
  const lastAt = useRef(0);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastAt.current < cooldownMs) return;
    lastAt.current = now;
    void prefetchCareerBundle();
  }, [cooldownMs, prefetchCareerBundle]);
}
