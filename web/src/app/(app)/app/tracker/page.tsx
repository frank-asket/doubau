import type { Metadata } from "next";

import { TrackerClient } from "@/components/tracker/TrackerClient";

export const metadata: Metadata = {
  title: "Job Tracker",
};

export const dynamic = "force-dynamic";

export default function TrackerPage() {
  return <TrackerClient />;
}

