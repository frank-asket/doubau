import type { Metadata } from "next";

import { PhaseLaunchPlaceholder } from "@/components/app/PhaseLaunchPlaceholder";

export const metadata: Metadata = {
  title: "Settings & billing",
};

export default function SettingsPage() {
  return (
    <PhaseLaunchPlaceholder phase="P1" title="Settings & billing" description="Manage account preferences and Stripe-backed subscriptions.">
      <div className="space-y-3">
        <p>
          Configure these on the <strong>API</strong> deployment for Checkout and webhooks (examples — names may match your
          Stripe dashboard):
        </p>
        <ul className="list-disc space-y-2 pl-5 font-[family-name:var(--font-app-mono)] text-[12px]">
          <li>STRIPE_SECRET_KEY</li>
          <li>STRIPE_WEBHOOK_SECRET</li>
          <li>STRIPE_PRICE_* (plan SKUs)</li>
        </ul>
        <p className="text-[12px] text-[var(--app-text-tertiary)]">
          Client-side publishable key can be exposed as{" "}
          <span className="font-[family-name:var(--font-app-mono)]">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span> when you wire
          Checkout from this route.
        </p>
      </div>
    </PhaseLaunchPlaceholder>
  );
}
