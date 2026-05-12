import type { Metadata } from "next";

import { NotificationsClient } from "@/components/workspace/NotificationsClient";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
