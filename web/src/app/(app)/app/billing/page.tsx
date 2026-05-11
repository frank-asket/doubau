import { Suspense } from "react";

import { BillingHub } from "@/components/billing/BillingHub";

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--app-text-secondary)]">Loading billing…</div>
      }
    >
      <BillingHub />
    </Suspense>
  );
}
