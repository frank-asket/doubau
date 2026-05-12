"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/app/career-profile": "Career Profile",
  "/app/pathfinder": "Career Pathfinder",
  "/app/career-steps": "Career Steps",
  "/app/planner": "Career Planner",
  "/app/career-success": "Career Success",
  "/app/discovery": "Job Discovery",
  "/app/tracker": "Job Tracker",
  "/app/sponsorship-hub": "Sponsorship Hub",
  "/app/salary-benchmark": "Salary Benchmark",
  "/app/copilot": "Career Copilot",
  "/app/cv-builder": "CV Builder",
  "/app/ats-optimizer": "ATS Optimizer",
  "/app/cover-letter": "Cover Letter",
  "/app/career-health": "Career Health",
  "/app/linkedin-analysis": "LinkedIn Analysis",
  "/app/skill-gap-analysis": "Skill Gap Analysis",
  "/app/discussion": "Discussion Board",
  "/app/settings": "Settings",
  "/app/billing": "Settings",
  "/app/notifications": "Notifications",
  "/app/search": "Search",
};

function titleForPath(pathname: string, firstName?: string | null) {
  if (pathname.startsWith("/app/discovery/")) return "Job Details";
  if (pathname === "/app/dashboard") {
    return firstName ? `Welcome back, ${firstName}!` : "Welcome back!";
  }
  return TITLES[pathname] ?? "Doubow";
}

function firstNameFromUser(user: ReturnType<typeof useUser>["user"]) {
  const clerkFirstName = user?.firstName?.trim();
  if (clerkFirstName) return clerkFirstName;

  const fullNameFirst = user?.fullName?.trim().split(/\s+/)[0];
  if (fullNameFirst) return fullNameFirst;

  const emailName = user?.primaryEmailAddress?.emailAddress?.split("@")[0];
  if (!emailName) return null;

  return emailName
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AppTopbar() {
  const pathname = usePathname();
  const { isLoaded, user } = useUser();
  const title = titleForPath(pathname, isLoaded ? firstNameFromUser(user) : null);

  return (
    <header className="sticky top-0 z-20 shrink-0 bg-[linear-gradient(180deg,rgba(244,247,242,0.98),rgba(244,247,242,0.78))] px-2 pt-3 backdrop-blur md:px-3">
      <div className="doubow-orb flex h-[var(--app-topbar-h)] items-center justify-between gap-4 rounded-[28px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.84)] px-5 shadow-[var(--app-shadow-1)] backdrop-blur-xl">
        <div className="relative min-w-0">
          <p className="hidden text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--app-accent-700)] md:block">
            Doubow workspace
          </p>
          <h1 className="min-w-0 truncate text-[24px] font-black tracking-[-0.035em] text-[var(--app-text-primary)] md:text-[30px]">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="relative hidden h-11 w-[320px] items-center gap-3 rounded-full border border-[var(--app-border)] bg-white/88 px-4 text-[14px] text-[var(--app-text-tertiary)] shadow-[var(--app-shadow-0)] lg:flex">
            <span className="text-[18px]" aria-hidden>
              O
            </span>
            <span className="sr-only">Search</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--app-text-tertiary)]"
              placeholder="Search..."
              type="search"
            />
            <kbd className="rounded-full bg-[var(--app-bg-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--app-text-secondary)]">
              ⌘K
            </kbd>
          </label>
          <button className="ch-icon-button hidden md:inline-flex" type="button" aria-label="Notifications">
            <span className="relative inline-flex size-2 rounded-full bg-[var(--app-accent)] shadow-[0_0_0_6px_rgba(32,209,125,0.12)]" aria-hidden />
          </button>
          <UserButton />
          <button className="hidden text-[14px] text-[var(--app-text-primary)] md:inline-flex" type="button" aria-label="User menu">
            ▾
          </button>
        </div>
      </div>
    </header>
  );
}
