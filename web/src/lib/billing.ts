/** Billing routes & Clerk plan ID helpers (Clerk Billing — experimental SDK). */

/** Aligns with Clerk Dashboard plan keys (`free_user`, `business`). */
export type PlanTier = "free" | "business";
/** Matches Clerk Billing `planPeriod` plus URL-friendly `year` alias. */
export type BillingInterval = "month" | "year";

/** Clerk CheckoutButton `planPeriod` (yearly billing uses `annual`). */
export type ClerkPlanPeriod = "month" | "annual";

export function clerkPlanPeriodFromInterval(interval: BillingInterval): ClerkPlanPeriod {
  return interval === "month" ? "month" : "annual";
}

/** Default in-app routes (override with NEXT_PUBLIC_*). */
export const DEFAULT_BILLING_CHECKOUT_PATH = "/app/billing/checkout";
export const DEFAULT_BILLING_PORTAL_PATH = "/app/billing/portal";

export function billingCheckoutBase(): string {
  const raw = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_URL?.trim();
  if (!raw) return DEFAULT_BILLING_CHECKOUT_PATH;
  return raw.replace(/\/$/, "");
}

export function billingPortalBase(): string {
  const raw = process.env.NEXT_PUBLIC_BILLING_PORTAL_URL?.trim();
  if (!raw) return DEFAULT_BILLING_PORTAL_PATH;
  return raw.replace(/\/$/, "");
}

/** True when checkout base is an absolute URL (e.g. Stripe Payment Link / external PSP). */
export function isExternalBillingCheckout(): boolean {
  const b = billingCheckoutBase();
  return b.startsWith("http://") || b.startsWith("https://");
}

export function buildCheckoutHref(
  tier: PlanTier,
  interval: BillingInterval,
  source: string,
): string {
  const base = billingCheckoutBase();
  const q = new URLSearchParams({ plan: tier, interval, source });
  if (base.startsWith("http://") || base.startsWith("https://")) {
    const u = new URL(base);
    u.searchParams.set("plan", tier);
    u.searchParams.set("interval", interval);
    u.searchParams.set("source", source);
    return u.toString();
  }
  const path = base.startsWith("/") ? base : `/${base}`;
  return `${path}?${q.toString()}`;
}

function trimEnv(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

/**
 * Resolve Clerk Dashboard plan id for CheckoutButton (month | year).
 * Reads `NEXT_PUBLIC_CLERK_PLAN_*` for Free and Business; falls back to legacy
 * Standard / Pro / Ultimate env names so older deployments keep working.
 */
export function clerkPlanIdFor(tier: PlanTier, interval: BillingInterval): string | undefined {
  const primary: Record<string, string | undefined> = {
    "free-month": trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_FREE_MONTH),
    "free-year": trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_FREE_YEAR),
    "business-month": trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_BUSINESS_MONTH),
    "business-year": trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_BUSINESS_YEAR),
  };

  const legacy: Record<string, string | undefined> = {
    "free-month": trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_STANDARD_MONTH),
    "free-year": trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_STANDARD_YEAR),
    "business-month":
      trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_PRO_MONTH) ||
      trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_ULTIMATE_MONTH),
    "business-year":
      trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_PRO_YEAR) ||
      trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_ULTIMATE_YEAR),
  };

  const key = `${tier}-${interval}` as const;
  const merged = primary[key] || legacy[key];
  if (merged) return merged;

  // Single plan id for tier (Clerk plan id works for the period you configured).
  const shorthand =
    tier === "free"
      ? trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_FREE) ||
        trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_STANDARD)
      : trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_BUSINESS) ||
        trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_PRO) ||
        trimEnv(process.env.NEXT_PUBLIC_CLERK_PLAN_ULTIMATE);

  return shorthand;
}

export function parsePlanTier(v: string | null): PlanTier {
  const x = v?.trim().toLowerCase();
  if (!x) return "free";
  if (x === "free" || x === "free_user" || x === "standard") return "free";
  if (x === "business" || x === "pro" || x === "ultimate") return "business";
  return "free";
}

export function parseBillingInterval(v: string | null): BillingInterval {
  if (v === "month") return "month";
  if (v === "year" || v === "annual") return "year";
  return "month";
}

export const PLAN_COPY: Record<
  PlanTier,
  { name: string; blurb: string; priceMonth: string; priceYear: string }
> = {
  free: {
    name: "Free",
    blurb: "Core discovery, tracker, and approvals — start without a subscription.",
    priceMonth: "£0/mo",
    priceYear: "£0/yr",
  },
  business: {
    name: "Business",
    blurb:
      "Higher limits and full workspace features. New customers get delayed billing for the first 30 days (trial), per your Clerk Billing settings.",
    priceMonth: "Trial · then monthly in Clerk",
    priceYear: "Trial · then yearly in Clerk",
  },
};
