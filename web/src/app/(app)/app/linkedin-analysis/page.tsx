import type { Metadata } from "next";

import { LinkedinAnalysisClient } from "@/components/workspace/LinkedinAnalysisClient";

export const metadata: Metadata = {
  title: "LinkedIn analysis",
};

export default function LinkedinAnalysisPage() {
  return <LinkedinAnalysisClient />;
}
