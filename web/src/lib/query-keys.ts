/** TanStack Query keys — keep centralized for invalidation + future WebSocket cache sync. */
export const queryKeys = {
  applications: ["applications"] as const,
  applicationDrafts: ["application-drafts"] as const,
  workspaceSummary: ["workspace-summary"] as const,
  profile: ["me-profile"] as const,
  checkIns: ["me-check-ins"] as const,
  milestones: ["milestones"] as const,
};
