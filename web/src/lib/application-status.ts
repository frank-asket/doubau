import type { AppBadgeVariant } from "@/components/ui/badge";

/** Mirrors `api/app/models/application.py` `ApplicationStatus`. */
export type ApplicationStatus =
  | "DISCOVERED"
  | "SCORING"
  | "DRAFTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SUBMITTED"
  | "FAILED"
  | "RETRY";

export function applicationStatusBadge(status: string): {
  variant: AppBadgeVariant;
  label: string;
} {
  switch (status as ApplicationStatus) {
    case "DISCOVERED":
      return { variant: "gray", label: "DISCOVERED" };
    case "SCORING":
      return { variant: "blue", label: "SCORING" };
    case "DRAFTED":
      return { variant: "blue", label: "DRAFTING" };
    case "PENDING_APPROVAL":
      return { variant: "amber", label: "PENDING" };
    case "APPROVED":
      return { variant: "green", label: "APPROVED" };
    case "SUBMITTED":
      return { variant: "green", label: "SENT" };
    case "FAILED":
      return { variant: "red", label: "FAILED" };
    case "RETRY":
      return { variant: "amber", label: "RETRY" };
    default:
      return { variant: "gray", label: status || "UNKNOWN" };
  }
}

export const PIPELINE_LEGEND: ReadonlyArray<{ variant: AppBadgeVariant; label: string }> = [
  { variant: "gray", label: "DISCOVERED" },
  { variant: "blue", label: "SCORING" },
  { variant: "blue", label: "DRAFTING" },
  { variant: "amber", label: "PENDING" },
  { variant: "green", label: "APPROVED" },
  { variant: "green", label: "SENT" },
  { variant: "red", label: "FAILED" },
  { variant: "amber", label: "RETRY" },
];
