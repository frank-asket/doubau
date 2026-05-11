import type { Metadata } from "next";

import { PlannerPageClient } from "@/components/workspace/PlannerPageClient";

export const metadata: Metadata = {
  title: "Career planner",
};

export default function PlannerPage() {
  return <PlannerPageClient />;
}
