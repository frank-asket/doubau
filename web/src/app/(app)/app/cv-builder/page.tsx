import type { Metadata } from "next";

import { CvBuilderClient } from "@/components/workspace/CvBuilderClient";

export const metadata: Metadata = {
  title: "CV builder",
};

export default function CvBuilderPage() {
  return <CvBuilderClient />;
}
