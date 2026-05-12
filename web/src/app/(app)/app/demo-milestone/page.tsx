import type { Metadata } from "next";

import { DemoMilestoneClient } from "@/components/workspace/DemoMilestoneClient";

export const metadata: Metadata = {
  title: "Demo milestone",
};

export default function DemoMilestonePage() {
  return <DemoMilestoneClient />;
}
