import type { ReactNode } from "react";

export function OnboardingStepFrame({
  eyebrow,
  title,
  description,
  stepLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stepLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="app-surface reveal rounded-[var(--app-radius-lg)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-balance text-[length:var(--app-text-h1)] font-semibold tracking-tight text-[var(--app-text-primary)]">
            {title}
          </h1>
        </div>
        <div className="hidden shrink-0 rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-muted)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] sm:block">
          {stepLabel}
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
