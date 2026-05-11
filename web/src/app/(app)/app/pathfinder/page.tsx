import type { Metadata } from "next";

import { PathfinderPageClient } from "@/components/workspace/PathfinderPageClient";

export const metadata: Metadata = {
  title: "Career pathfinder",
};

export default function PathfinderPage() {
  return <PathfinderPageClient />;
}
