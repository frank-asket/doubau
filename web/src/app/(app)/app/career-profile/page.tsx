import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Career profile",
};

export default function CareerProfilePage() {
  return (
    <PhaseLaunchPlaceholder
      title="Career profile"
      description="Create the profile DouBow uses to personalize job matches, career paths, and weekly recommendations."
    />
  );
}
