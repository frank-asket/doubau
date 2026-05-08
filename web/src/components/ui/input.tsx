import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type AppInputProps = InputHTMLAttributes<HTMLInputElement>;

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border-strong)] bg-[var(--app-bg-elevated)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] shadow-none outline-none transition-[border-color,box-shadow]",
        "placeholder:text-[var(--app-text-tertiary)]",
        "focus:border-[var(--app-accent)] focus:shadow-[0_0_0_3px_var(--app-ring-color)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
