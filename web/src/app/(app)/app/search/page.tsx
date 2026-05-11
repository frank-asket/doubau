import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Global search",
};

export default function SearchPage() {
  return (
    <PhaseLaunchPlaceholder
      title="Search"
      description="Quickly find jobs, applications, drafts, career tools, settings, and saved work across DouBow."
    />
  );
}
