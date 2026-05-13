import type { AppNavSection } from "@/components/app/AppSidebarNav";

/** Single source of truth for workspace sidebar + command palette “Pages”. */
export const appNavSections: AppNavSection[] = [
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
        href: "/app/ats-optimizer",
        label: "ATS Optimizer",
        icon: "filter",
        subtitle: "Tune your résumé for applicant systems",
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
