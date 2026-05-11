import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import {
  AppSidebarNav,
  type AppNavSection,
} from "@/components/app/AppSidebarNav";
import { AppThemeShell } from "@/components/app/AppThemeShell";
import { AppProviders } from "@/components/providers/AppProviders";
import { DouBowLogo } from "@/components/brand/DouBowLogo";

const NAV_SECTIONS: AppNavSection[] = [
  {
    id: "core",
    title: "Core product",
    items: [
      {
        href: "/app/dashboard",
        label: "Dashboard",
        subtitle: "Overview, profile signals, and resume status",
      },
      {
        href: "/app/discovery",
        label: "Discovery",
        subtitle: "Feed, fit, and role details",
      },
      {
        href: "/app/approvals",
        label: "Approvals",
        subtitle: "HITL: review drafts before send",
      },
      {
        href: "/app/tracker",
        label: "Job tracker",
        subtitle: "Pipeline from saved roles to submitted apps",
      },
      {
        href: "/app/analytics",
        label: "Match analytics",
        subtitle: "Match quality and discovery signals",
      },
      {
        href: "/app/copilot",
        label: "Copilot",
        subtitle: "Career answers grounded in your résumé",
      },
      {
        href: "/app/billing",
        label: "Billing",
        subtitle: "Plans, checkout, and subscription portal",
      },
    ],
  },
  {
    id: "roadmap-p1",
    title: "Roadmap · P1",
    collapsible: true,
    items: [
      {
        href: "/app/planner",
        label: "Career planner",
        subtitle: "Priorities from live workspace signals",
      },
      {
        href: "/app/pathfinder",
        label: "Career pathfinder",
        subtitle: "Persona + profile-grounded guidance",
      },
      {
        href: "/app/career-steps",
        label: "Career steps",
        subtitle: "Milestone timeline synced to the API",
      },
      {
        href: "/app/career-success",
        label: "Career success",
        subtitle: "Pipeline health + discovery engagement",
      },
      {
        href: "/app/ats-optimizer",
        label: "ATS optimizer",
        subtitle: "Paste a JD; fit vs your résumé",
      },
      {
        href: "/app/settings",
        label: "Settings & billing",
        subtitle: "Profile API + link to subscriptions",
      },
    ],
  },
  {
    id: "roadmap-p2",
    title: "Roadmap · P2",
    collapsible: true,
    items: [
      {
        href: "/app/cv-builder",
        label: "CV builder",
        subtitle: "Parsed résumé text from the API",
      },
      {
        href: "/app/cover-letter",
        label: "Cover letter",
        subtitle: "Email drafts from your pipeline",
      },
      {
        href: "/app/career-health",
        label: "Career health",
        subtitle: "Summary + discovery metrics snapshot",
      },
      {
        href: "/app/linkedin-analysis",
        label: "LinkedIn analysis",
        subtitle: "LinkedIn drafts tied to applications",
      },
      {
        href: "/app/salary-benchmark",
        label: "Salary benchmark",
        subtitle: "Feed snapshot (no salary fields yet)",
      },
      {
        href: "/app/sponsorship-hub",
        label: "Sponsorship hub",
        subtitle: "Keyword filter over your job feed",
      },
      {
        href: "/app/discussion",
        label: "Discussion board",
        subtitle: "Discovery activity timeline",
      },
    ],
  },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const mobileItems = NAV_SECTIONS[0]?.items ?? [];

  return (
    <AppProviders>
    <AppThemeShell className="flex flex-row">
      <aside
        className="hidden min-h-screen w-[var(--app-sidebar-w)] shrink-0 flex-col border-r border-white/[0.06] px-4 py-8 md:flex"
        style={{ backgroundColor: "var(--app-sidebar)" }}
      >
        <Link href="/app/dashboard" className="inline-flex shrink-0 items-center gap-2 px-2 font-semibold">
          <DouBowLogo variant="white" text="DouBow" size={26} />
        </Link>
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <AppSidebarNav sections={NAV_SECTIONS} />
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
          className="sticky top-0 z-20 flex h-[var(--app-topbar-h)] shrink-0 items-center justify-between border-b-[0.5px] border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg-elevated)_94%,transparent)] px-4 backdrop-blur md:px-6"
        >
          <Link href="/app/dashboard" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--app-text-primary)] md:hidden">
            <DouBowLogo variant="black" text="DouBow" size={24} />
          </Link>
          <div className="hidden text-[13px] font-semibold text-[var(--app-text-primary)] md:block">Workspace</div>
          <UserButton />
        </header>
        <nav
          aria-label="Primary workspace"
          className="sticky top-[var(--app-topbar-h)] z-10 flex gap-2 overflow-x-auto border-b-[0.5px] border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg-page)_96%,transparent)] px-4 py-2 backdrop-blur md:hidden"
        >
          {mobileItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 text-[12px] font-medium text-[var(--app-text-secondary)] shadow-[var(--app-shadow-0)] transition-[border-color,color,background-color,transform] duration-150 ease-out active:scale-[0.96]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      </main>
    </AppThemeShell>
    </AppProviders>
  );
}
