import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { AppSidebarNav } from "@/components/app/AppSidebarNav";
import { AppThemeShell } from "@/components/app/AppThemeShell";
import { AppProviders } from "@/components/providers/AppProviders";
import { DouBowLogo } from "@/components/brand/DouBowLogo";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/analytics", label: "Match analytics" },
  { href: "/app/discovery", label: "Job Discovery" },
  { href: "/app/tracker", label: "Job Tracker" },
  { href: "/app/approvals", label: "Approval dashboard" },
  { href: "/app/copilot", label: "Copilot" },
  { href: "/app/planner", label: "Career Planner" },
  { href: "/app/pathfinder", label: "Career Pathfinder" },
  { href: "/app/career-success", label: "Career Success" },
  { href: "/app/ats-optimizer", label: "ATS Optimizer" },
  { href: "/app/settings", label: "Settings & billing" },
  { href: "/app/cv-builder", label: "CV Builder" },
  { href: "/app/cover-letter", label: "Cover Letter" },
  { href: "/app/career-health", label: "Career Health" },
  { href: "/app/linkedin-analysis", label: "LinkedIn Analysis" },
  { href: "/app/salary-benchmark", label: "Salary Benchmark" },
  { href: "/app/sponsorship-hub", label: "Sponsorship Hub" },
  { href: "/app/discussion", label: "Discussion Board" },
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
    <AppThemeShell className="flex flex-row">
      <aside
        className="flex min-h-screen w-[var(--app-sidebar-w)] shrink-0 flex-col border-r border-white/[0.06] px-4 py-8"
        style={{ backgroundColor: "var(--app-sidebar)" }}
      >
        <Link href="/app/dashboard" className="inline-flex shrink-0 items-center gap-2 px-2 font-semibold">
          <DouBowLogo variant="white" text="DouBow" size={26} />
        </Link>
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <AppSidebarNav items={[...NAV_ITEMS]} />
        </div>
        <div className="shrink-0 pt-6">
          <Link
            href="/app/design-system"
            className="block rounded-md px-3 py-2 text-[11px] text-[var(--app-sidebar-muted)] transition-colors hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white/70"
          >
            Design references
          </Link>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-bg-page)]">
        <header
          className="flex h-[var(--app-topbar-h)] shrink-0 items-center justify-between border-b-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-6"
        >
          <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">Workspace</div>
          <UserButton />
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </main>
    </AppThemeShell>
    </AppProviders>
  );
}
