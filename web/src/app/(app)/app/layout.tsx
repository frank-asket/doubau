import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getApiBaseUrl, getBackendAuthHeaders } from "@/app/api/_server";
import { appNavSections } from "@/config/app-nav-sections";
import {
  AppSidebarNav,
  type AppNavItem,
  type AppNavSection,
} from "@/components/app/AppSidebarNav";
import { AppThemeShell } from "@/components/app/AppThemeShell";
import { AppTopbar } from "@/components/app/AppTopbar";
import { AppProviders } from "@/components/providers/AppProviders";
import { ApplicationsPipelineRealtimeProvider } from "@/components/providers/ApplicationsPipelineRealtimeProvider";
import { CareerAiAssistantDock } from "@/components/copilot/CareerAiAssistantDock";
import { CareerGrowthProvider } from "@/components/providers/CareerGrowthProvider";
import { DouBowLogo } from "@/components/brand/DouBowLogo";
import { AppIcon } from "@/components/ui/app-icon";
import { copilotFontVariables } from "@/fonts/copilot";

const NAV_SECTIONS: AppNavSection[] = appNavSections;

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
    <ApplicationsPipelineRealtimeProvider>
    <CareerGrowthProvider>
    <AppThemeShell className={`flex flex-row bg-[var(--app-bg-page)] ${copilotFontVariables}`}>
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
        <div className="flex-1 overflow-y-auto px-2 py-3 pb-28 sm:px-3 sm:pb-24">
          {children}
        </div>
        <CareerAiAssistantDock />
      </main>
    </AppThemeShell>
    </CareerGrowthProvider>
    </ApplicationsPipelineRealtimeProvider>
    </AppProviders>
  );
}
