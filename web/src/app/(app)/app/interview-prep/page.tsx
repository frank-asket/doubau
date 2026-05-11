import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Interview prep",
};

export default function InterviewPrepPage() {
  return (
    <PhaseLaunchPlaceholder
      title="Interview prep"
      description="Practice likely interview questions, shape stronger answers, and prepare around the roles you are targeting."
    />
  );
}
