/** TanStack Query keys — keep centralized for invalidation + future WebSocket cache sync. */
export const queryKeys = {
  applications: ["applications"] as const,
  applicationDrafts: ["application-drafts"] as const,
};
