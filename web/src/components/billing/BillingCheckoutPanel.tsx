"use client";

import { CheckoutButton } from "@clerk/nextjs/experimental";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  clerkPlanIdFor,
  clerkPlanPeriodFromInterval,
  PLAN_COPY,
  type BillingInterval,
  type PlanTier,
} from "@/lib/billing";
import { AppButton } from "@/components/ui/button";

type Props = {
  tier: PlanTier;
  interval: BillingInterval;
  source: string;
};

/**
 * In-app Clerk Billing checkout. Requires Clerk Billing plan IDs in env
 * (NEXT_PUBLIC_CLERK_PLAN_*). Success returns per Clerk; we recommend
 * Clerk Dashboard redirect URL → `/billing?checkout=success` (mapped to `/app/billing`).
 */
export function BillingCheckoutPanel({ tier, interval, source }: Props) {
  const router = useRouter();
  const planId = clerkPlanIdFor(tier, interval);
  const copy = PLAN_COPY[tier];

  if (!planId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-8">
        <h1 className="text-[length:var(--app-text-title)] font-semibold text-[var(--app-text-primary)]">
          Checkout not configured
        </h1>
        <p className="text-[14px] leading-6 text-[var(--app-text-secondary)]">
          Set Clerk Billing plan IDs for <strong>{copy.name}</strong> ({interval}) in environment variables, e.g.{" "}
          <code className="rounded bg-[var(--app-bg-page)] px-1.5 py-0.5 font-mono text-[12px]">
            NEXT_PUBLIC_CLERK_PLAN_{tier.toUpperCase()}_{interval === "month" ? "MONTH" : "YEAR"}
          </code>
          . Create plans in the Clerk Dashboard → Billing.
        </p>
        <Link
          href="/app/billing"
          className="inline-flex rounded-[var(--app-radius-pill)] border-[0.5px] border-solid border-[var(--app-border-strong)] bg-transparent px-4 py-[7px] text-[13px] font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-bg-muted)]"
        >
          Back to billing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Checkout · {source}
        </p>
        <h1 className="mt-2 text-[length:var(--app-text-title)] font-semibold text-[var(--app-text-primary)]">
          {copy.name}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--app-text-secondary)]">{copy.blurb}</p>
        <p className="mt-3 text-[13px] font-medium text-[var(--app-text-primary)]">
          Billed {interval === "month" ? "monthly" : "yearly"}
        </p>
      </div>

      <CheckoutButton
        planId={planId}
        planPeriod={clerkPlanPeriodFromInterval(interval)}
        onSubscriptionComplete={() => {
          router.replace("/app/billing?checkout=success");
          router.refresh();
        }}
      >
        <AppButton className="w-full justify-center">Subscribe with Clerk</AppButton>
      </CheckoutButton>

      <p className="text-center text-[12px] text-[var(--app-text-tertiary)]">
        Prefer to cancel?{" "}
        <Link className="font-medium text-[var(--app-accent)] hover:underline" href="/app/billing?checkout=cancel">
          Return to billing
        </Link>
      </p>
    </div>
  );
}
