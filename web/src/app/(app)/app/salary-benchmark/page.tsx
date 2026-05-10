import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Salary Benchmark",
};

export default function SalaryBenchmarkPage() {
  return (
    <PhaseLaunchPlaceholder
      phase="P2"
      title="Salary Benchmark"
      description="Comp bands by role, region, and seniority — fed by trusted salary datasets when integrated."
    />
  );
}
