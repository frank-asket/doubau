"use client";

import { useEffect } from "react";

import { buildCheckoutHref, type BillingInterval, type PlanTier } from "@/lib/billing";

type Props = {
  tier: PlanTier;
  interval: BillingInterval;
  source: string;
};

/** Full-page redirect when NEXT_PUBLIC_BILLING_CHECKOUT_URL is an external HTTPS URL. */
export function BillingCheckoutRedirect({ tier, interval, source }: Props) {
  useEffect(() => {
    window.location.replace(buildCheckoutHref(tier, interval, source));
  }, [tier, interval, source]);

  return (
    <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-8 text-center">
      <p className="text-[14px] text-[var(--app-text-secondary)]">Redirecting to checkout…</p>
    </div>
  );
}
