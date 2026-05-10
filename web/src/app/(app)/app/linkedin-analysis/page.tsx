import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "LinkedIn Analysis",
};

export default function LinkedInAnalysisPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="LinkedIn Analysis"
      description="Profile strength, headline/body suggestions, and consistency with your CV narrative."
    />
  );
}
