import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscription",
};

export default function BillingPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
