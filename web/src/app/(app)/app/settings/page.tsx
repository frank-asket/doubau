import type { Metadata } from "next";

import { SettingsProfileClient } from "@/components/workspace/SettingsProfileClient";

export const metadata: Metadata = {
  title: "Settings & billing",
};

export default function SettingsPage() {
  return <SettingsProfileClient />;
}
