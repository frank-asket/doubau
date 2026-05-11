import type { ReactNode } from "react";
import Link from "next/link";

import { AppThemeShell } from "@/components/app/AppThemeShell";
import { DouBowLogo } from "@/components/brand/DouBowLogo";
import { OnboardingProgress, type OnboardingStep } from "@/components/onboarding/OnboardingProgress";

const steps: OnboardingStep[] = [
  { href: "/onboarding/career", label: "Career", detail: "Situation, role, experience" },
  { href: "/onboarding/contact", label: "Location", detail: "City, country, preferences" },
  { href: "/onboarding/resume", label: "Résumé", detail: "Upload or skip for now" },
  { href: "/onboarding/goals", label: "Goals", detail: "Choose your focus areas" },
  { href: "/onboarding/plan", label: "Plan", detail: "Pick your workspace level" },
];

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AppThemeShell className="min-h-screen flex-row bg-[var(--app-bg-page)]">
      <aside className="hidden min-h-screen w-[320px] shrink-0 flex-col overflow-hidden bg-[var(--app-sidebar)] px-6 py-8 text-white md:flex">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <DouBowLogo variant="white" text="DouBow" size={26} />
        </Link>
        <div className="mt-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">
            Onboarding
          </div>
          <p className="mt-3 max-w-[240px] text-pretty text-[13px] leading-5 text-white/58">
            Set up the workspace once. DouBow uses this profile to rank roles, draft safely, and keep your search organized.
          </p>
        </div>
        <div className="mt-6">
          <OnboardingProgress steps={steps} />
        </div>
        <div className="mt-auto pt-8">
          <div className="rounded-[var(--app-radius-lg)] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-1.5 border-b border-white/10 pb-2">
              <span className="size-2 rounded-full bg-[#ff5f57]" />
              <span className="size-2 rounded-full bg-[#febc2e]" />
              <span className="size-2 rounded-full bg-[#28c840]" />
              <span className="ml-auto text-[10px] font-medium text-white/40">First workspace</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-[var(--app-radius-md)] bg-white px-3 py-2 text-[var(--app-text-primary)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold">Top job picks</span>
                  <span className="rounded-[var(--app-radius-pill)] bg-[var(--app-badge-blue-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--app-accent)]">
                    Ready
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--app-bg-muted)]">
                  <div className="h-full w-[72%] rounded-full bg-[var(--app-accent)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[var(--app-radius-md)] bg-white/8 p-2">
                  <div className="text-[10px] text-white/42">Fit score</div>
                  <div className="mt-1 text-[18px] font-semibold tabular-nums">87%</div>
                </div>
                <div className="rounded-[var(--app-radius-md)] bg-white/8 p-2">
                  <div className="text-[10px] text-white/42">Drafts</div>
                  <div className="mt-1 text-[18px] font-semibold tabular-nums">3</div>
                </div>
              </div>
              <div className="rounded-[var(--app-radius-md)] bg-white/8 p-2 text-[11px] leading-4 text-white/58">
                Nothing is sent until you approve it.
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-[var(--app-bg-page)]">
        <header className="flex h-[var(--app-topbar-h)] shrink-0 items-center justify-between border-b-[0.5px] border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg-elevated)_94%,transparent)] px-4 backdrop-blur md:hidden">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--app-text-primary)]">
            <DouBowLogo variant="black" text="DouBow" size={24} />
          </Link>
          <span className="rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1 text-[12px] font-medium text-[var(--app-text-secondary)]">
            Setup
          </span>
        </header>
        <div className="border-b-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {steps.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 text-[12px] font-medium text-[var(--app-text-secondary)]"
              >
                {step.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-10">
          <div className="w-full max-w-[720px]">{children}</div>
        </div>
      </main>
    </AppThemeShell>
  );
}
