import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "ATS Optimizer",
};

export default function AtsOptimizerPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P1"
      title="ATS Optimizer"
      description="Résumé parsing checks and keyword alignment suggestions against saved job descriptions."
    />
  );
}
