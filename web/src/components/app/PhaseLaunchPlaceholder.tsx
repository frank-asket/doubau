import type { ReactNode } from "react";

export function PhaseLaunchPlaceholder({
  title,
  eyebrow = "Coming soon",
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          {description ??
            "This workspace is being prepared. You can keep using the rest of DouBow while this feature comes online."}
        </p>
      </div>
      {children ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
