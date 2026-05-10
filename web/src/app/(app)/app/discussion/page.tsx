import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Discussion Board",
};

export default function DiscussionBoardPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="Discussion Board"
      description="Community Q&A and cohort discussions — requires moderation and persistence layers."
    />
  );
}
