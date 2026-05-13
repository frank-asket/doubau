import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import {
  AppSidebarNav,
  type AppNavItem,
  type AppNavSection,
} from "@/components/app/AppSidebarNav";
import { AppThemeShell } from "@/components/app/AppThemeShell";
import { AppTopbar } from "@/components/app/AppTopbar";
import { AppProviders } from "@/components/providers/AppProviders";
import { CareerGrowthProvider } from "@/components/providers/CareerGrowthProvider";
import { DouBowLogo } from "@/components/brand/DouBowLogo";
import { AppIcon } from "@/components/ui/app-icon";

const NAV_SECTIONS: AppNavSection[] = [
  {
    id: "home",
    title: "Home",
    items: [
      {
        href: "/app/dashboard",
        label: "Dashboard",
        icon: "home",
        subtitle: "Your job search at a glance",
      },
    ],
  },
  {
    id: "job-search",
    title: "Job search",
    collapsible: true,
    items: [
      {
        href: "/app/discovery",
        label: "Job Discovery",
        icon: "briefcase",
        subtitle: "Browse roles that match your goals",
      },
      {
        href: "/app/tracker",
        label: "Job Tracker",
        icon: "layers",
        subtitle: "Track every role from saved to submitted",
      },
      {
        href: "/app/approvals",
        label: "Draft approvals",
        icon: "check-circle",
        subtitle: "Review messages before they go out",
      },
      {
        href: "/app/analytics",
        label: "Match insights",
        icon: "analytics",
        subtitle: "See what is working in your search",
      },
    ],
  },
  {
    id: "career-growth",
    title: "Career growth",
    collapsible: true,
    items: [
      {
        href: "/app/career-profile",
        label: "Career Profile",
        icon: "star",
        subtitle: "Your narrative, strengths, and positioning",
      },
      {
        href: "/app/career-steps",
        label: "Career Steps",
        icon: "clipboard-check",
        subtitle: "Follow a step-by-step growth plan",
      },
      {
        href: "/app/pathfinder",
        label: "Career Pathfinder",
        icon: "arrow-up-right",
        subtitle: "Explore directions that fit your goals",
      },
      {
        href: "/app/planner",
        label: "Career Planner",
        icon: "layers",
        subtitle: "Plan milestones and timelines",
      },
      {
        href: "/app/career-success",
        label: "Career Success",
        icon: "check-circle",
        subtitle: "Celebrate wins and progress",
      },
      {
        href: "/app/career-health",
        label: "Career Health",
        icon: "analytics",
        subtitle: "Balance, burnout signals, and sustainability",
      },
      {
        href: "/app/salary-benchmark",
        label: "Salary Benchmark",
        icon: "star-filled",
        subtitle: "Compare compensation for your role",
      },
      {
        href: "/app/linkedin-analysis",
        label: "LinkedIn Analysis",
        icon: "upload",
        subtitle: "Optimize your profile for discovery",
      },
      {
        href: "/app/sponsorship-hub",
        label: "Sponsorship Hub",
        icon: "briefcase",
        subtitle: "Visa sponsorship intel when it matters",
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    collapsible: true,
    items: [
      {
        href: "/app/copilot",
        label: "Career Copilot",
        icon: "sparkle",
        subtitle: "Get guidance for strategy and next steps",
      },
      {
        href: "/app/cv-builder",
        label: "CV Builder",
        icon: "file-text",
        subtitle: "Build and refine your résumé",
      },
      {
        href: "/app/cover-letter",
        label: "Cover letters",
        icon: "file-text",
        subtitle: "Create tailored letters faster",
      },
      {
        href: "/app/interview-prep",
        label: "Interview prep",
        icon: "clipboard-check",
        subtitle: "Practice questions for your target roles",
      },
      {
        href: "/app/skill-gap-analysis",
        label: "Skills gap",
        icon: "filter",
        subtitle: "Know what to learn next",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    collapsible: true,
    items: [
      {
        href: "/app/search",
        label: "Search",
        icon: "search",
        subtitle: "Find jobs, drafts, and tools quickly",
      },
      {
        href: "/app/notifications",
        label: "Notifications",
        icon: "bell",
        subtitle: "Updates, reminders, and interview alerts",
      },
      {
        href: "/app/discussion",
        label: "Discussion Board",
        icon: "message-circle",
        subtitle: "Questions, stories, and shared advice",
      },
      {
        href: "/app/settings",
        label: "Settings",
        icon: "settings",
        subtitle: "Profile, preferences, and security",
      },
      {
        href: "/app/billing",
        label: "Billing",
        icon: "star-filled",
        subtitle: "Plan, payment, and subscription",
      },
    ],
  },
];

function navItemAt(sections: AppNavSection[], sectionId: string, index: number): AppNavItem {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) throw new Error(`Nav section not found: ${sectionId}`);
  const item = section.items[index];
  if (!item) throw new Error(`Nav item missing: ${sectionId}[${index}]`);
  return item;
}

/**
 * Mobile strip — same destinations as the legacy numeric index list, but resolved by section id
 * so inserting/reordering sections does not move meanings between groups.
 * Order: Dashboard → Discovery → Tracker → Career Profile → Pathfinder → Copilot → Search.
 */
const MOBILE_NAV_ITEMS: AppNavItem[] = [
  navItemAt(NAV_SECTIONS, "home", 0),
  navItemAt(NAV_SECTIONS, "job-search", 0),
  navItemAt(NAV_SECTIONS, "job-search", 1),
  navItemAt(NAV_SECTIONS, "career-growth", 0),
  navItemAt(NAV_SECTIONS, "career-growth", 2),
  navItemAt(NAV_SECTIONS, "tools", 0),
  navItemAt(NAV_SECTIONS, "account", 0),
];

type OnboardingProfile = {
  persona?: string | null;
  goals?: { focus?: unknown } | null;
  plan_tier?: string | null;
};

function onboardingStepFor(profile: OnboardingProfile): string | null {
  if (!profile.persona) return "/onboarding/career";
  const goalsFocus = profile.goals?.focus;
  if (!Array.isArray(goalsFocus) || goalsFocus.length === 0) {
    return "/onboarding/goals";
  }
  if (!profile.plan_tier) return "/onboarding/plan";
  return null;
}

async function getOnboardingProfile(): Promise<OnboardingProfile | null> {
  try {
    const resp = await fetch(`${getApiBaseUrl()}/me/profile`, {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    return (await resp.json().catch(() => null)) as OnboardingProfile | null;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getOnboardingProfile();
  const onboardingPath = profile ? onboardingStepFor(profile) : null;
  if (onboardingPath) {
    redirect(onboardingPath);
  }

  const mobileItems = MOBILE_NAV_ITEMS;

  return (
    <AppProviders>
    <CareerGrowthProvider>
    <AppThemeShell className="flex flex-row bg-[var(--app-bg-page)]">
      <aside
        className="relative hidden min-h-screen w-[var(--app-sidebar-w)] shrink-0 flex-col overflow-hidden px-5 py-5 md:flex"
        style={{
          background:
            "radial-gradient(circle at 18% 8%, rgba(32,209,125,0.18), transparent 30%), linear-gradient(180deg, #07110d 0%, #091712 52%, #030705 100%)",
        }}
      >
        <div className="pointer-events-none absolute bottom-20 left-[-90px] h-48 w-48 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-[-70px] top-28 h-40 w-40 rounded-full bg-[rgba(32,209,125,0.08)] blur-2xl" />
        <Link href="/app/dashboard" className="relative inline-flex shrink-0 items-center gap-2 px-2 py-3 font-semibold">
          <DouBowLogo variant="white" text="Doubow" size={24} />
        </Link>
        <div className="relative mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 text-[12px] leading-5 text-white/62">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-accent)]">
            Talent cockpit
          </span>
          Job discovery, resume review, and application operations in one workspace.
        </div>
        <div className="relative mt-6 min-h-0 flex-1 overflow-y-auto">
          <AppSidebarNav sections={NAV_SECTIONS} />
        </div>
        <div className="relative space-y-2 border-t border-white/[0.08] pt-5 text-[14px] font-medium text-[var(--app-sidebar-muted)]">
          <Link className="flex min-h-11 items-center gap-3 rounded-xl px-3 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/[0.05] hover:text-white/80 active:scale-[0.96]" href="/app/settings">
            <AppIcon name="settings" className="size-4" /> Settings
          </Link>
          <span className="flex min-h-11 items-center gap-3 rounded-xl px-3">
            <AppIcon name="log-out" className="size-4" /> Log Out
          </span>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-bg-page)]">
        <AppTopbar />
        <nav
          aria-label="Primary workspace"
          className="sticky top-[var(--app-topbar-h)] z-10 flex gap-2 overflow-x-auto border-b-[0.5px] border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg-page)_96%,transparent)] px-4 py-2 backdrop-blur md:hidden"
        >
          {mobileItems.map((item) => (
            <Link
              key={`${item.href}:${item.label}`}
              href={item.href}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 text-[12px] font-medium text-[var(--app-text-secondary)] shadow-[var(--app-shadow-0)] transition-[border-color,color,background-color,transform] duration-150 ease-out active:scale-[0.96]"
            >
              <AppIcon name={item.icon ?? "circle"} className="size-4 text-[var(--app-text-tertiary)]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-3">
          {children}
        </div>
      </main>
    </AppThemeShell>
    </CareerGrowthProvider>
    </AppProviders>
  );
}
