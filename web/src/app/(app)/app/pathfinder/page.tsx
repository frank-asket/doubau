import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Career Pathfinder",
};

export default function PathfinderPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P1"
      title="Career Pathfinder"
      description="Explore adjacent roles and skill bridges based on your CV and market signals."
    />
  );
}
