import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return (
    <PhaseLaunchPlaceholder
      title="Notifications"
      description="Keep track of application updates, draft reminders, interview prep, résumé changes, and weekly career nudges."
    />
  );
}
