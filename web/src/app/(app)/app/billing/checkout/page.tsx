"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { BillingCheckoutPanel } from "@/components/billing/BillingCheckoutPanel";
import { BillingCheckoutRedirect } from "@/components/billing/BillingCheckoutRedirect";
import {
  isExternalBillingCheckout,
  parseBillingInterval,
  parsePlanTier,
} from "@/lib/billing";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const tier = parsePlanTier(searchParams.get("plan"));
  const interval = parseBillingInterval(searchParams.get("interval"));
  const source = searchParams.get("source") || "checkout";

  if (isExternalBillingCheckout()) {
    return <BillingCheckoutRedirect tier={tier} interval={interval} source={source} />;
  }

  return <BillingCheckoutPanel tier={tier} interval={interval} source={source} />;
}

export default function BillingCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--app-text-secondary)]">Loading checkout…</div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
