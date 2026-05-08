import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type AppBadgeVariant = "blue" | "green" | "amber" | "red" | "purple" | "gray";

export type AppBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: AppBadgeVariant;
};

const variantClass: Record<AppBadgeVariant, string> = {
  blue: "bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-fg)]",
  green: "bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-fg)]",
  amber: "bg-[var(--app-badge-amber-bg)] text-[var(--app-badge-amber-fg)]",
  red: "bg-[var(--app-badge-red-bg)] text-[var(--app-badge-red-fg)]",
  purple: "bg-[var(--app-badge-purple-bg)] text-[var(--app-badge-purple-fg)]",
  gray:
    "border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-badge-gray-bg)] text-[var(--app-badge-gray-fg)]",
};

export function AppBadge({ className, variant = "gray", ...props }: AppBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-[var(--app-radius-pill)] px-2.5 py-0.5 text-[12px] font-medium leading-5",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
