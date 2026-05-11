"use client";

import { CheckoutButton } from "@clerk/nextjs/experimental";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AppButton } from "@/components/ui/button";
import {
  buildCheckoutHref,
  clerkPlanIdFor,
  clerkPlanPeriodFromInterval,
  billingPortalBase,
  PLAN_COPY,
  type BillingInterval,
  type PlanTier,
} from "@/lib/billing";

const TIERS: PlanTier[] = ["standard", "pro", "ultimate"];

export function BillingHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");

  const [interval, setInterval] = useState<BillingInterval>("month");

  const banner = useMemo(() => {
    if (checkout === "success") {
      return {
        tone: "success" as const,
        title: "Checkout complete",
        body: "Thanks — your subscription should appear in Clerk Billing shortly. You can manage it anytime below.",
      };
    }
    if (checkout === "cancel") {
      return {
        tone: "muted" as const,
        title: "Checkout canceled",
        body: "No charges were made. Pick a plan when you're ready.",
      };
    }
    return null;
  }, [checkout]);

  const portalHref = billingPortalBase();
  const portalIsExternal = portalHref.startsWith("http://") || portalHref.startsWith("https://");

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Billing
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          Subscribe with Clerk Billing (beta). Configure plan IDs from the Clerk Dashboard; optional Stripe-style URLs go in{" "}
          <code className="rounded bg-[var(--app-bg-muted)] px-1 font-mono text-[12px]">NEXT_PUBLIC_BILLING_*</code>.
        </p>
      </div>

      {banner ? (
        <div
          role="status"
          className={
            banner.tone === "success"
              ? "rounded-[var(--app-radius-lg)] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-100"
              : "rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 text-[13px] text-[var(--app-text-secondary)]"
          }
        >
          <div className="font-semibold text-[var(--app-text-primary)]">{banner.title}</div>
          <p className="mt-1">{banner.body}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3">
        <div className="text-[13px] text-[var(--app-text-secondary)]">
          <span className="font-medium text-[var(--app-text-primary)]">Billing interval</span>
        </div>
        <div className="inline-flex rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] p-0.5">
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={
                interval === iv
                  ? "rounded-[calc(var(--app-radius-md)-2px)] bg-[var(--app-accent)] px-3 py-1.5 text-[12px] font-medium text-white"
                  : "rounded-[calc(var(--app-radius-md)-2px)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
              }
            >
              {iv === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {portalIsExternal ? (
          <a
            href={portalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-4 py-[7px] text-[13px] font-medium text-white hover:bg-[var(--app-accent-hover)]"
          >
            Manage subscription (external)
          </a>
        ) : (
          <Link
            href={portalHref}
            className="inline-flex rounded-[var(--app-radius-pill)] border border-transparent bg-[var(--app-accent)] px-4 py-[7px] text-[13px] font-medium text-white hover:bg-[var(--app-accent-hover)]"
          >
            Manage subscription
          </Link>
        )}
      </div>

      <div className="grid gap-[var(--app-space-lg)] md:grid-cols-3">
        {TIERS.map((tier) => {
          const copy = PLAN_COPY[tier];
          const planId = clerkPlanIdFor(tier, interval);
          const price = interval === "month" ? copy.priceMonth : copy.priceYear;
          const deepLink = buildCheckoutHref(tier, interval, "billing");

          return (
            <div
              key={tier}
              className="flex flex-col rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                {tier}
              </div>
              <div className="mt-2 text-[18px] font-semibold text-[var(--app-text-primary)]">{copy.name}</div>
              <div className="mt-1 text-[13px] text-[var(--app-text-secondary)]">{copy.blurb}</div>
              <div className="mt-4 text-[15px] font-semibold tabular-nums text-[var(--app-text-primary)]">{price}</div>

              <div className="mt-6 flex flex-col gap-2">
                {planId ? (
                  <CheckoutButton
                    planId={planId}
                    planPeriod={clerkPlanPeriodFromInterval(interval)}
                    onSubscriptionComplete={() => {
                      router.replace("/app/billing?checkout=success");
                      router.refresh();
                    }}
                  >
                    <AppButton className="w-full justify-center">Subscribe</AppButton>
                  </CheckoutButton>
                ) : (
                  <AppButton
                    className="w-full justify-center"
                    variant="outline"
                    type="button"
                    onClick={() => router.push(deepLink)}
                  >
                    Open checkout
                  </AppButton>
                )}
                {!planId ? (
                  <p className="text-center text-[11px] text-[var(--app-text-tertiary)]">
                    Set plan IDs in env, or use{" "}
                    <Link className="text-[var(--app-accent)] hover:underline" href={deepLink}>
                      hosted checkout path
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
