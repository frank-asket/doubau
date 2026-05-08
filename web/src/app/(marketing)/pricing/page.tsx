import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/marketing/Container";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans for candidates who want speed with control.",
};

const plans = {
  standard: {
    name: "Standard",
    label: "DouBow Standard",
    price: "£15",
    unit: "/month",
    blurb: "AI drafts. You decide. Nothing moves without you.",
    bullets: [
      "AI Career Copilot (Quick Actions)",
      "Smart Profile Optimization",
      "Interview Intelligence",
      "Approval gate (HITL) enforced at the API",
      "Job discovery + tracker",
    ],
  },
  pro: {
    name: "Pro",
    label: "DouBow Pro",
    price: "£25",
    unit: "/month",
    blurb: "All Standard + expanded limits and usage.",
    bullets: [
      "Everything in Standard",
      "Expanded limits and usage",
      "More drafts, scoring, and prep",
      "Faster throughput for workflows",
      "Priority support (as available)",
    ],
  },
};

export default function PricingPage() {
  const starter = plans.standard;
  const enterprise = plans.pro;

  return (
    <main id="main" className="py-40">
      <Container>
        <div className="mx-auto max-w-[1000px]">
          <div className="flex flex-col gap-4 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Our pricing
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Pricing that matches throughput
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-[var(--muted)]">
              Choose a tier that matches your weekly cadence. Every plan keeps the approval gate.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {/* Standard */}
            <div className="min-h-[650px] w-full max-w-[480px] justify-self-center rounded-[32px] border border-[var(--border)] bg-[var(--background)] p-10 shadow-[var(--shadow)]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {starter.label}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-5xl font-semibold tracking-tight tabular-nums">
                  {starter.price}
                </div>
                <div className="text-sm font-semibold text-[var(--muted)]">{starter.unit}</div>
              </div>

              <div className="mt-6 h-px w-full bg-[var(--border)]" />

              <ul className="mt-7 space-y-3 text-sm text-[var(--muted)]">
                {starter.bullets.map((b) => (
                  <li key={b} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[11px] font-bold text-[var(--muted)]"
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Link
                  href="/signup"
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-black px-8 text-sm font-semibold text-white transition-transform active:scale-[0.96]"
                >
                  Get Started
                </Link>
              </div>

              <div className="mt-10 rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] p-5">
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span className="font-semibold">Draft preview</span>
                  <span className="tabular-nums">01</span>
                </div>
                <div className="mt-4 grid gap-2">
                  <div className="h-2 w-[72%] rounded-full bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" />
                  <div className="h-2 w-[86%] rounded-full bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" />
                  <div className="h-2 w-[62%] rounded-full bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" />
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <div className="h-9 w-28 rounded-xl bg-black" />
                  <div className="h-9 w-24 rounded-xl border border-[var(--border)] bg-transparent" />
                </div>
              </div>
            </div>

            {/* Pro */}
            <div className="min-h-[650px] w-full max-w-[480px] justify-self-center rounded-[32px] border border-white/10 bg-[var(--deep)] p-10 text-white shadow-[var(--shadow)]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/75">
                {enterprise.label}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-5xl font-semibold tracking-tight tabular-nums">
                  {enterprise.price}
                </div>
                <div className="text-sm font-semibold text-white/70">{enterprise.unit}</div>
              </div>

              <div className="mt-6 h-px w-full bg-white/10" />

              <ul className="mt-7 space-y-3 text-sm text-white/80">
                {enterprise.bullets.map((b) => (
                  <li key={b} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-black"
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Link
                  href="/signup"
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-8 text-sm font-semibold text-black transition-transform active:scale-[0.96]"
                >
                  Start Now
                </Link>
              </div>

              <div className="mt-10 rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span className="font-semibold text-white/80">Pipeline</span>
                  <span className="tabular-nums">p95</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-white/10" />
                      <div>
                        <div className="h-2 w-24 rounded-full bg-white/15" />
                        <div className="mt-2 h-2 w-16 rounded-full bg-white/10" />
                      </div>
                    </div>
                    <div className="h-7 w-16 rounded-lg bg-[var(--accent)]" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-9 rounded-xl bg-white/5" />
                    <div className="h-9 rounded-xl bg-white/5" />
                    <div className="h-9 rounded-xl bg-white/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-10 text-xs text-[var(--muted)]">
            Billing and plan enforcement will be implemented via Stripe (webhooks + customer portal).
          </p>
        </div>
      </Container>
    </main>
  );
}

