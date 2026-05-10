import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Career Health",
};

export default function CareerHealthPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="Career Health"
      description="Cadence and wellness signals while job searching — streaks, workload balance, and burnout checks."
    />
  );
}
