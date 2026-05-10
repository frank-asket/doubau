import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Sponsorship Hub",
};

export default function SponsorshipHubPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="Sponsorship Hub"
      description="UK/Global visa sponsorship signals for roles you track — data-dependent integrations."
    />
  );
}
