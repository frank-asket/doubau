import type { Metadata } from "next";

import { AtsOptimizerClient } from "@/components/workspace/AtsOptimizerClient";

export const metadata: Metadata = {
  title: "ATS optimizer",
};

export default function AtsOptimizerPage() {
  return <AtsOptimizerClient />;
}
