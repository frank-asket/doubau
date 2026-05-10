import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Career Planner",
};

export default function PlannerPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P1"
      title="Career Planner"
      description="Goals, milestones, and timelines aligned to your persona and target roles."
    />
  );
}
