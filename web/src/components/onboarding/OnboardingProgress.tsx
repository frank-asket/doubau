"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type OnboardingStep = {
  href: string;
  label: string;
  detail: string;
};

export function OnboardingProgress({ steps }: { steps: OnboardingStep[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Onboarding progress" className="space-y-2">
      {steps.map((step, index) => {
        const active = pathname === step.href;
        const complete = steps.findIndex((item) => item.href === pathname) > index;
        return (
          <Link
            key={step.href}
            href={step.href}
            className={[
              "group flex min-h-12 items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
              active
                ? "bg-[var(--app-sidebar-active-bg)] text-white"
                : "text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white",
            ].join(" ")}
          >
            <span
              className={[
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                active
                  ? "bg-[var(--app-accent)] text-white"
                  : complete
                    ? "bg-white/15 text-white"
                    : "border border-white/15 text-white/60",
              ].join(" ")}
            >
              {complete ? "✓" : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-5">{step.label}</span>
              <span
                className={[
                  "block truncate text-[11px] leading-4",
                  active ? "text-white/70" : "text-white/40 group-hover:text-white/60",
                ].join(" ")}
              >
                {step.detail}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
