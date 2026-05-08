import type { ReactNode } from "react";
import Link from "next/link";

import { DouBowLogo } from "@/components/brand/DouBowLogo";

const steps = [
  { href: "/onboarding/career", label: "Career" },
  { href: "/onboarding/contact", label: "Contact" },
  { href: "/onboarding/goals", label: "Goals" },
  { href: "/onboarding/plan", label: "Plan" },
];

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <aside className="hidden w-72 border-r border-[var(--border)] px-6 py-10 md:block">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <DouBowLogo variant="black" text="DouBow" size={26} />
        </Link>
        <div className="mt-8 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Onboarding
        </div>
        <nav className="mt-3 space-y-1">
          {steps.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex flex-1 justify-center px-4 py-12">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}

