import type { Metadata } from "next";

import { SponsorshipHubClient } from "@/components/workspace/SponsorshipHubClient";

export const metadata: Metadata = {
  title: "Sponsorship hub",
};

export default function SponsorshipHubPage() {
  return <SponsorshipHubClient />;
}
