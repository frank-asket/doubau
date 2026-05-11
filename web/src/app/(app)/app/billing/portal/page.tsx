"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import Link from "next/link";

import { AppButton } from "@/components/ui/button";

export default function BillingPortalPage() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Subscription
        </h1>
        <p className="mt-2 text-[14px] text-[var(--app-text-secondary)]">
          View or change your plan, payment method, renewal, or cancellation settings.
        </p>
      </div>

      {!isLoaded ? (
        <div className="text-[13px] text-[var(--app-text-secondary)]">Loading session…</div>
      ) : isSignedIn ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6">
          <SubscriptionDetailsButton>
            <AppButton className="w-full justify-center">Open subscription details</AppButton>
          </SubscriptionDetailsButton>
          <p className="mt-4 text-center text-[12px] text-[var(--app-text-tertiary)]">
            Your subscription details open in a secure billing panel.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 text-[14px] text-[var(--app-text-secondary)]">
          Sign in to manage your subscription.
          <div className="mt-4">
            <SignInButton mode="modal">
              <AppButton className="justify-center">Sign in</AppButton>
            </SignInButton>
          </div>
        </div>
      )}

      <Link
        href="/app/billing"
        className="text-[13px] font-medium text-[var(--app-accent)] hover:underline"
      >
        ← Back to billing
      </Link>
    </div>
  );
}
