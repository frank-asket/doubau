/** Billing routes & Clerk plan ID helpers (Clerk Billing — experimental SDK). */

export type PlanTier = "standard" | "pro" | "ultimate";
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

/** Resolve Clerk Dashboard plan id for CheckoutButton (month | year). */
export function clerkPlanIdFor(tier: PlanTier, interval: BillingInterval): string | undefined {
  const envMap: Record<string, string | undefined> = {
    "standard-month": process.env.NEXT_PUBLIC_CLERK_PLAN_STANDARD_MONTH,
    "standard-year": process.env.NEXT_PUBLIC_CLERK_PLAN_STANDARD_YEAR,
    "pro-month": process.env.NEXT_PUBLIC_CLERK_PLAN_PRO_MONTH,
    "pro-year": process.env.NEXT_PUBLIC_CLERK_PLAN_PRO_YEAR,
    "ultimate-month": process.env.NEXT_PUBLIC_CLERK_PLAN_ULTIMATE_MONTH,
    "ultimate-year": process.env.NEXT_PUBLIC_CLERK_PLAN_ULTIMATE_YEAR,
  };
  const key = `${tier}-${interval}` as const;
  const direct = envMap[key]?.trim();
  if (direct) return direct;
  // Fallback: single id per tier (assume monthly)
  if (interval === "month") {
    const fallback = {
      standard: process.env.NEXT_PUBLIC_CLERK_PLAN_STANDARD?.trim(),
      pro: process.env.NEXT_PUBLIC_CLERK_PLAN_PRO?.trim(),
      ultimate: process.env.NEXT_PUBLIC_CLERK_PLAN_ULTIMATE?.trim(),
    }[tier];
    if (fallback) return fallback;
  }
  return undefined;
}

export function parsePlanTier(v: string | null): PlanTier {
  if (v === "standard" || v === "pro" || v === "ultimate") return v;
  return "pro";
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
  standard: {
    name: "Standard",
    blurb: "Core discovery and tracker for steady explorers.",
    priceMonth: "£15/mo",
    priceYear: "£150/yr",
  },
  pro: {
    name: "Pro",
    blurb: "Full pipeline, drafts, and Copilot for active search.",
    priceMonth: "£25/mo",
    priceYear: "£250/yr",
  },
  ultimate: {
    name: "Ultimate",
    blurb: "Maximum automation with premium support surfaces.",
    priceMonth: "£50/mo",
    priceYear: "£500/yr",
  },
};
