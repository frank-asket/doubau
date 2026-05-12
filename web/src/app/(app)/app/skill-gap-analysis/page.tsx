import type { Metadata } from "next";

import { SkillGapAnalysisClient } from "@/components/workspace/SkillGapAnalysisClient";

export const metadata: Metadata = {
  title: "Skill gap analysis",
};

export default function SkillGapAnalysisPage() {
  return <SkillGapAnalysisClient />;
}
