import type { Metadata } from "next";

import { CoverLetterClient } from "@/components/workspace/CoverLetterClient";

export const metadata: Metadata = {
  title: "Cover letter",
};

export default function CoverLetterPage() {
  return <CoverLetterClient />;
}
