import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type AppButtonVariant = "primary" | "outline" | "ghost" | "danger" | "approve";
export type AppButtonSize = "sm" | "md" | "lg";

/** DOM handlers that clash with Framer Motion props on `motion.button`. */
type ButtonAttrs = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
>;

export type AppButtonProps = ButtonAttrs & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  { className, children, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type={type}
      whileHover={reduced ? undefined : { scale: 1.015 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 font-medium shadow-[var(--app-shadow-0)] transition-[background-color,border-color,color,box-shadow]",
        "duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-page)]",
        "disabled:pointer-events-none disabled:opacity-50",
        variant !== "ghost" &&
          size === "sm" &&
          "rounded-[var(--app-radius-pill)] px-3 py-1 text-[12px] leading-5",
        variant !== "ghost" &&
          size === "md" &&
          "rounded-[var(--app-radius-pill)] px-4 py-[7px] text-[13px] leading-5",
        variant !== "ghost" &&
          size === "lg" &&
          "rounded-[var(--app-radius-pill)] px-6 py-[11px] text-[15px] leading-6",
        variant === "ghost" &&
          size === "sm" &&
          "rounded-[var(--app-radius-pill)] px-2 py-1 text-[12px] leading-5",
        variant === "ghost" &&
          size === "md" &&
          "rounded-[var(--app-radius-pill)] px-2.5 py-[7px] text-[13px] leading-5",
        variant === "ghost" &&
          size === "lg" &&
          "rounded-[var(--app-radius-pill)] px-3 py-[11px] text-[15px] leading-6",
        variant === "primary" &&
          "border border-transparent bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-hover)]",
        variant === "outline" &&
          "border-[0.5px] border-solid border-[var(--app-border-strong)] bg-transparent text-[var(--app-text-primary)] hover:bg-[var(--app-bg-muted)]",
        variant === "ghost" &&
          "border-0 bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-text-primary)]",
        variant === "danger" &&
          "border-0 bg-[var(--app-btn-danger-bg)] text-[var(--app-btn-danger-fg)] hover:brightness-[0.97]",
        variant === "approve" &&
          "border-0 bg-[var(--app-btn-approve-bg)] text-[var(--app-btn-approve-fg)] hover:brightness-[0.97]",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
});
