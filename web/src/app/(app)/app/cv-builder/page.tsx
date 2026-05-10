import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "CV Builder",
};

export default function CvBuilderPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="CV Builder"
      description="Structured résumé authoring with section templates and version history."
    />
  );
}
