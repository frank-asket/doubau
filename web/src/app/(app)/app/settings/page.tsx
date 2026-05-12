import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsProfileClient } from "@/components/workspace/SettingsProfileClient";

export const metadata: Metadata = {
  title: "Settings & billing",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-[13px] text-[var(--app-text-secondary)]">Loading settings…</p>}>
      <SettingsProfileClient />
    </Suspense>
  );
}
