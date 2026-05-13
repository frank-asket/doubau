import type { AppIconName } from "@/components/ui/app-icon";

/** Exact `/app/*` paths → topbar / wayfinding icon (subset of sidebar semantics). */
export const APP_PAGE_ICONS: Record<string, AppIconName> = {
  "/app/career-profile": "star",
  "/app/pathfinder": "arrow-up-right",
  "/app/career-steps": "clipboard-check",
  "/app/planner": "layers",
  "/app/career-success": "check-circle",
  "/app/discovery": "briefcase",
  "/app/tracker": "layers",
  "/app/sponsorship-hub": "briefcase",
  "/app/salary-benchmark": "star-filled",
  "/app/copilot": "sparkle",
  "/app/cv-builder": "file-text",
  "/app/ats-optimizer": "filter",
  "/app/cover-letter": "file-text",
  "/app/career-health": "analytics",
  "/app/linkedin-analysis": "upload",
  "/app/skill-gap-analysis": "filter",
  "/app/discussion": "message-circle",
  "/app/settings": "settings",
  "/app/notifications": "bell",
  "/app/search": "search",
  "/app/approvals": "check-circle",
  "/app/analytics": "analytics",
  "/app/interview-prep": "clipboard-check",
  "/app/design-system": "layers",
};

export function appPageIcon(pathname: string): AppIconName {
  if (pathname === "/app/dashboard") return "home";
  if (pathname.startsWith("/app/discovery/")) return "briefcase";
  if (pathname.startsWith("/app/billing")) return "star-filled";
  return APP_PAGE_ICONS[pathname] ?? "circle";
}
