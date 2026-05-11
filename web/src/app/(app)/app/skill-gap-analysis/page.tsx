import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Skill gap analysis",
};

export default function SkillGapAnalysisPage() {
  return (
    <PhaseLaunchPlaceholder
      title="Skills gap"
      description="See which skills matter most for your target roles, then turn the gaps into a practical learning plan."
    />
  );
}
