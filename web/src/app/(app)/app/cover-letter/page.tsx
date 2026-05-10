import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Cover Letter",
};

export default function CoverLetterPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="Cover Letter"
      description="Role-specific letters grounded in your CV and job posting context."
    />
  );
}
