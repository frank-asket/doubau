import type { ReactNode } from "react";
import Link from "next/link";

import { AppThemeShell } from "@/components/app/AppThemeShell";
import { DouBowLogo } from "@/components/brand/DouBowLogo";

const steps = [
  { href: "/onboarding/career", label: "Career" },
  { href: "/onboarding/contact", label: "Contact" },
  { href: "/onboarding/resume", label: "Résumé" },
  { href: "/onboarding/goals", label: "Goals" },
  { href: "/onboarding/plan", label: "Plan" },
];

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AppThemeShell className="flex flex-row">
      <aside className="hidden w-72 shrink-0 border-r border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-6 py-10 md:block">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <DouBowLogo variant="black" text="DouBow" size={26} />
        </Link>
        <div className="mt-8 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Onboarding
        </div>
        <nav className="mt-3 space-y-1">
          {steps.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-[var(--app-radius-md)] px-3 py-2 text-[13px] text-[var(--app-text-secondary)] transition-colors hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-text-primary)]"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 justify-center bg-[var(--app-bg-page)] px-4 py-12">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </AppThemeShell>
  );
}

