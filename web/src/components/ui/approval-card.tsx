"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AppBadge, type AppBadgeVariant } from "./badge";
import { AppButton } from "./button";

export type AppApprovalCardProps = {
  title: string;
  subtitle?: string;
  badgeLabel: string;
  badgeVariant?: AppBadgeVariant;
  snippet: ReactNode;
  /** When set, replaces the default Approve / Edit / Reject row (e.g. Submit-only). */
  actionsSlot?: ReactNode;
  /** Disables default Approve / Edit / Reject (ignored when `actionsSlot` is set). */
  actionsDisabled?: boolean;
  onApprove?: () => void | Promise<void>;
  onEdit?: () => void;
  onReject?: () => void | Promise<void>;
  className?: string;
};

export function AppApprovalCard({
  title,
  subtitle,
  badgeLabel,
  badgeVariant = "amber",
  snippet,
  actionsSlot,
  actionsDisabled,
  onApprove,
  onEdit,
  onReject,
  className,
}: AppApprovalCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--app-radius-lg)] border-[1.5px] border-solid border-[var(--app-border)] p-3.5 transition-[border-color,opacity]",
        "hover:border-[var(--app-accent)]",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-snug text-[var(--app-text-primary)]">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-[var(--app-text-secondary)]">{subtitle}</div>
          ) : null}
        </div>
        <AppBadge variant={badgeVariant}>{badgeLabel}</AppBadge>
      </div>

      <div className="rounded-[var(--app-radius-badge)] border-l-[3px] border-l-[var(--app-accent)] bg-[var(--app-bg-muted)] px-2.5 py-2.5 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
        {snippet}
      </div>

      {actionsSlot === undefined ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <AppButton
            disabled={actionsDisabled}
            size="sm"
            variant="approve"
            type="button"
            onClick={() => void onApprove?.()}
          >
            ✓ Approve
          </AppButton>
          <AppButton disabled={actionsDisabled} size="sm" variant="outline" type="button" onClick={onEdit}>
            ✏ Edit
          </AppButton>
          <AppButton
            disabled={actionsDisabled}
            size="sm"
            variant="danger"
            type="button"
            onClick={() => void onReject?.()}
          >
            ✕ Reject
          </AppButton>
        </div>
      ) : actionsSlot ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">{actionsSlot}</div>
      ) : null}
    </div>
  );
}
