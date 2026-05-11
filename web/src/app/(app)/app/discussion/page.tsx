import type { Metadata } from "next";

import { DiscussionActivityClient } from "@/components/workspace/DiscussionActivityClient";

export const metadata: Metadata = {
  title: "Discussion board",
};

export default function DiscussionPage() {
  return <DiscussionActivityClient />;
}
