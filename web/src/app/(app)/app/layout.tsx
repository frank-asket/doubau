import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import {
  AppSidebarNav,
  type AppNavSection,
} from "@/components/app/AppSidebarNav";
import { AppThemeShell } from "@/components/app/AppThemeShell";
import { AppTopbar } from "@/components/app/AppTopbar";
import { AppSetupReminder, type AppSetupReminderKind } from "@/components/app/AppSetupReminder";
import { AppProviders } from "@/components/providers/AppProviders";
import { DouBowLogo } from "@/components/brand/DouBowLogo";

const NAV_SECTIONS: AppNavSection[] = [
  {
    id: "home",
    title: "Home",
    items: [
      {
        href: "/app/dashboard",
        label: "Dashboard",
        icon: "⌂",
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
        icon: "●",
        subtitle: "Browse roles that match your goals",
      },
      {
        href: "/app/tracker",
        label: "Job Tracker",
        icon: "▣",
        subtitle: "Track every role from saved to submitted",
      },
      {
        href: "/app/approvals",
        label: "Draft approvals",
        subtitle: "Review messages before they go out",
      },
      {
        href: "/app/salary-benchmark",
        label: "Salary Benchmark",
        icon: "$",
        subtitle: "Compare pay ranges before you apply",
      },
      {
        href: "/app/sponsorship-hub",
        label: "Sponsorship Hub",
        icon: "▣",
        subtitle: "Check sponsors and visa fit",
      },
      {
        href: "/app/analytics",
        label: "Match insights",
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
        icon: "◦",
        subtitle: "Set your goals, skills, and preferences",
      },
      {
        href: "/app/pathfinder",
        label: "Career Pathfinder",
        icon: "◇",
        subtitle: "Explore roles that fit your next move",
      },
      {
        href: "/app/career-steps",
        label: "Career Steps",
        icon: "☑",
        subtitle: "Follow a step-by-step growth plan",
      },
      {
        href: "/app/planner",
        label: "Career Planner",
        icon: "□",
        subtitle: "Plan milestones and weekly priorities",
      },
      {
        href: "/app/career-success",
        label: "Career Success",
        icon: "✓",
        subtitle: "Track skills, goals, and momentum",
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
        icon: "✦",
        subtitle: "Get guidance for strategy and next steps",
      },
      {
        href: "/app/cv-builder",
        label: "CV Builder",
        icon: "▤",
        subtitle: "Build and refine your résumé",
      },
      {
        href: "/app/ats-optimizer",
        label: "ATS Optimizer",
        icon: "◎",
        subtitle: "Compare your résumé with a job post",
      },
      {
        href: "/app/cover-letter",
        label: "Cover letters",
        subtitle: "Create tailored letters faster",
      },
      {
        href: "/app/career-health",
        label: "Career Health",
        icon: "◌",
        subtitle: "Check your readiness and weekly focus",
      },
      {
        href: "/app/linkedin-analysis",
        label: "LinkedIn Analysis",
        icon: "in",
        subtitle: "Improve your profile and positioning",
      },
      {
        href: "/app/interview-prep",
        label: "Interview prep",
        subtitle: "Practice questions for your target roles",
      },
      {
        href: "/app/skill-gap-analysis",
        label: "Skills gap",
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
        subtitle: "Find jobs, drafts, and tools quickly",
      },
      {
        href: "/app/notifications",
        label: "Notifications",
        subtitle: "Updates, reminders, and interview alerts",
      },
      {
        href: "/app/discussion",
        label: "Discussion Board",
        icon: "▣",
        subtitle: "Questions, stories, and shared advice",
      },
      {
        href: "/app/settings",
        label: "Settings",
        subtitle: "Profile, preferences, and security",
      },
      {
        href: "/app/billing",
        label: "Billing",
        subtitle: "Plan, payment, and subscription",
      },
    ],
  },
];

const MOBILE_NAV_ITEMS = [
  NAV_SECTIONS[0].items[0],
  NAV_SECTIONS[1].items[0],
  NAV_SECTIONS[1].items[2],
  NAV_SECTIONS[1].items[1],
  NAV_SECTIONS[3].items[0],
  NAV_SECTIONS[4].items[0],
];

type OnboardingProfile = {
  persona?: string | null;
  goals?: { focus?: unknown } | null;
  plan_tier?: string | null;
};

type LatestResume = {
  id?: string;
  status?: string | null;
};

function onboardingStepFor(profile: OnboardingProfile): string | null {
  if (!profile.persona) return "/onboarding/career";
  if (!Array.isArray(profile.goals?.focus) || profile.goals.focus.length === 0) {
    return "/onboarding/goals";
  }
  if (!profile.plan_tier) return "/onboarding/plan";
  return null;
}

async function getOnboardingRedirect(): Promise<string | null> {
  try {
    const resp = await fetch(`${getApiBaseUrl()}/me/profile`, {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const profile = (await resp.json().catch(() => ({}))) as OnboardingProfile;
    return onboardingStepFor(profile);
  } catch {
    return null;
  }
}

function setupReminderForResume(resume: LatestResume | null): AppSetupReminderKind | null {
  if (!resume?.id) return "resume_missing";
  if (resume.status === "FAILED") return "resume_failed";
  if (resume.status === "UPLOADED") return "resume_processing";
  return null;
}

async function getSetupReminder(): Promise<AppSetupReminderKind | null> {
  try {
    const resp = await fetch(`${getApiBaseUrl()}/me/resume/latest`, {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    if (resp.status === 404) return "resume_missing";
    if (!resp.ok) return null;
    const resume = (await resp.json().catch(() => null)) as LatestResume | null;
    return setupReminderForResume(resume);
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const onboardingPath = await getOnboardingRedirect();
  if (onboardingPath) {
    redirect(onboardingPath);
  }

  const setupReminder = await getSetupReminder();
  const mobileItems = MOBILE_NAV_ITEMS;

  return (
    <AppProviders>
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
          AI-powered job discovery, career planning, and application operations.
        </div>
        <div className="relative mt-6 min-h-0 flex-1 overflow-y-auto">
          <AppSidebarNav sections={NAV_SECTIONS} />
        </div>
        <div className="relative space-y-2 border-t border-white/[0.08] pt-5 text-[14px] font-medium text-[var(--app-sidebar-muted)]">
          <Link className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-white/[0.05] hover:text-white/80" href="/app/settings">
            <span aria-hidden>⚙</span> Settings
          </Link>
          <span className="flex min-h-11 items-center gap-3 rounded-xl px-3">
            <span aria-hidden>↩</span> Log Out
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
              className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 text-[12px] font-medium text-[var(--app-text-secondary)] shadow-[var(--app-shadow-0)] transition-[border-color,color,background-color,transform] duration-150 ease-out active:scale-[0.96]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-3">
          <AppSetupReminder kind={setupReminder} />
          {children}
        </div>
      </main>
    </AppThemeShell>
    </AppProviders>
  );
}
