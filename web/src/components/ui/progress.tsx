import { cn } from "@/lib/utils";

export type AppProgressTone = "success" | "warning" | "info";

const toneColor: Record<AppProgressTone, string> = {
  success: "bg-[var(--app-success)]",
  warning: "bg-[var(--app-warning)]",
  info: "bg-[var(--app-accent)]",
};

const toneLabel: Record<AppProgressTone, string> = {
  success: "text-[var(--app-success)]",
  warning: "text-[var(--app-warning)]",
  info: "text-[var(--app-accent)]",
};

export type AppProgressProps = {
  label: string;
  value: number;
  tone?: AppProgressTone;
  className?: string;
};

export function AppProgress({ label, value, tone = "info", className }: AppProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex justify-between text-[12px] text-[var(--app-text-secondary)]">
        <span>{label}</span>
        <span className={cn("font-medium tabular-nums", toneLabel[tone])}>{pct}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-[var(--app-radius-pill)] bg-[var(--app-bg-muted)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-[var(--app-radius-pill)] transition-[width] duration-300", toneColor[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
