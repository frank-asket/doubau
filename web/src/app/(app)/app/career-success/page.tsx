import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Career Success",
};

export default function CareerSuccessPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P1"
      title="Career Success"
      description="Outcome tracking: interviews secured, offers, and progression milestones."
    />
  );
}
