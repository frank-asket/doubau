import type { Metadata } from "next";

import { WorkspaceSearchClient } from "@/components/workspace/WorkspaceSearchClient";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return <WorkspaceSearchClient />;
}
