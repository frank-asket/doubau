import type { Metadata } from "next";

import { InterviewPrepClient } from "@/components/workspace/InterviewPrepClient";

export const metadata: Metadata = {
  title: "Interview prep",
};

export default function InterviewPrepPage() {
  return <InterviewPrepClient />;
}
