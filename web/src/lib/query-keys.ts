/** TanStack Query keys — keep centralized for invalidation + future WebSocket cache sync. */
export const queryKeys = {
  applications: ["applications"] as const,
  applicationDrafts: ["application-drafts"] as const,
  workspaceSummary: ["workspace-summary"] as const,
  profile: ["me-profile"] as const,
  resumeLatest: ["me-resume-latest"] as const,
  checkIns: ["me-check-ins"] as const,
  milestones: ["milestones"] as const,
  matchMetrics: (days: number) => ["match-metrics", days] as const,
  matchEvents: ["match-events"] as const,
  jobsFeed: (limit: number) => ["jobs-feed", limit] as const,
};
