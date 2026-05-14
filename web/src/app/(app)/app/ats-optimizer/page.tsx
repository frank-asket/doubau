import type { Metadata } from "next";
import { Suspense } from "react";

import { AtsOptimizerClient } from "@/components/workspace/AtsOptimizerClient";

export const metadata: Metadata = {
  title: "ATS optimizer",
};

export default function AtsOptimizerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[var(--app-text-secondary)]">Loading…</div>}>
      <AtsOptimizerClient />
    </Suspense>
  );
}
