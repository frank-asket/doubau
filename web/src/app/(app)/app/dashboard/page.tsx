import type { Metadata } from "next";
import Link from "next/link";

import { HeroDashboardShell, type HeroDashboardPayload } from "@/components/dashboard/HeroDashboardShell";
import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

async function loadHeroDashboard(): Promise<HeroDashboardPayload | null> {
  const base = getApiBaseUrl();
  const headers = await getBackendAuthHeaders();
  const res = await fetch(`${base}/me/hero-dashboard`, { headers, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as HeroDashboardPayload | null;
}

export default async function DashboardPage() {
  const data = await loadHeroDashboard();

  if (!data) {
    return (
      <section className="dashboard-card rounded-[28px] border border-[var(--app-border)] bg-white/90 p-8 shadow-[var(--app-shadow-1)]">
        <h1 className="text-[22px] font-black tracking-[-0.03em] text-[var(--app-text-primary)]">Dashboard</h1>
        <p className="mt-3 max-w-lg text-[14px] leading-6 text-[var(--app-text-secondary)]">
          We could not load your personalized dashboard from the API. Check that the backend is running and you are
          signed in, then refresh this page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ChromePrimaryLink href="/app/discovery">Open job discovery</ChromePrimaryLink>
          <Link
            href="/app/tracker"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius-pill)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-4 text-[13px] font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-0)] transition-[background-color,color] duration-150 hover:bg-[var(--app-bg-muted)]"
          >
            Job tracker
          </Link>
        </div>
      </section>
    );
  }

  return <HeroDashboardShell data={data} />;
}
