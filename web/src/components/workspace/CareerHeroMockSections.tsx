"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type Tone = "green" | "red" | "blue" | "pink";

const toneColor: Record<Tone, string> = {
  green: "var(--app-success)",
  red: "var(--app-danger)",
  blue: "var(--app-accent)",
  pink: "#e879d2",
};

export function MiniBars({ tone = "green" }: { tone?: Tone }) {
  return (
    <div className="flex h-12 items-end gap-2" aria-hidden>
      {[18, 26, 36, 46, 54, 42, 34, 38, 24].map((h, i) => (
        <span
          key={`${h}-${i}`}
          className="w-2 rounded-full"
          style={{ height: h, backgroundColor: toneColor[tone], opacity: i > 6 ? 0.72 : 1 }}
        />
      ))}
    </div>
  );
}

export function MetricCard({
  title,
  value,
  unit,
  delta,
  tone = "green",
  icon = "circle",
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: Tone;
  icon?: AppIconName;
  children?: ReactNode;
}) {
  return (
    <section className="ch-panel p-5">
      <h2 className="text-[17px] font-bold text-[var(--app-text-primary)]">{title}</h2>
      <div className="mt-7 flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--app-blue-50)] text-[var(--app-accent)]">
          <AppIcon name={icon} className="size-5" />
        </span>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="tabular-nums text-[32px] font-bold tracking-tight text-[var(--app-text-primary)]">
            {value}
          </span>
          {unit ? <span className="text-[13px] font-semibold text-[var(--app-text-primary)]">{unit}</span> : null}
          {delta ? (
            <span
              className={`text-[13px] font-bold ${tone === "red" ? "text-[var(--app-danger)]" : "text-[var(--app-success)]"}`}
            >
              {delta}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-[130px_1fr] sm:items-center">
        <MiniBars tone={tone} />
        <p className="text-[13px] leading-5 text-[var(--app-text-secondary)]">
          {children ?? "Your progress changed over the past 30 days."}
        </p>
      </div>
    </section>
  );
}

export function CareerFlowProgress({
  steps,
  active,
  value,
}: {
  steps: string[];
  active: string;
  value: number;
}) {
  const activeIndex = Math.max(0, steps.indexOf(active));

  return (
    <section className="ch-panel px-5 py-5 sm:px-7">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
        {steps.map((step, index) => {
          const complete = index < activeIndex;
          const current = step === active;
          return (
            <div key={step} className="flex min-w-[150px] flex-1 items-center gap-3 sm:min-w-0">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)] ${
                  complete || current
                    ? "bg-[var(--app-blue-500)] text-white"
                    : "bg-[var(--app-bg-muted)] text-[var(--app-text-tertiary)]"
                }`}
              >
                {complete ? "✓" : index + 1}
              </span>
              <span
                className={`truncate text-[14px] font-bold ${
                  complete || current ? "text-[var(--app-blue-500)]" : "text-[var(--app-text-secondary)]"
                }`}
              >
                {step}
              </span>
              {index < steps.length - 1 ? (
                <span className="hidden h-px flex-1 bg-[var(--app-border)] sm:block" aria-hidden />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-7 grid grid-cols-[1fr_auto] items-center gap-5">
        <ProgressLine value={value} />
        <span className="tabular-nums text-[18px] font-black text-[var(--app-text-primary)]">{value}%</span>
      </div>
    </section>
  );
}

export function Gauge({ value, label, icon = "circle" }: { value: number; label: string; icon?: AppIconName }) {
  const deg = Math.max(0, Math.min(100, value)) * 3.6;
  return (
    <div
      className="mx-auto grid size-56 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--app-success) 0deg ${deg}deg, #eceff4 ${deg}deg 360deg)`,
      }}
    >
      <div className="grid size-36 place-items-center rounded-full bg-white text-center">
        <div>
          <AppIcon name={icon} className="mx-auto size-6 text-[var(--app-accent)]" />
          <div className="tabular-nums text-[32px] font-bold text-[var(--app-text-primary)]">{value}</div>
          <div className="text-[14px] text-[var(--app-text-secondary)]">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function SegmentedTabs({
  items,
  value,
  onChange,
  size = "md",
  ariaLabel = "Section",
}: {
  items: string[];
  value: string;
  onChange: (item: string) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const pad = size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-10 px-5 text-[14px]";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-full bg-[var(--app-bg-muted)] p-1 shadow-[inset_0_0_0_1px_rgba(17,22,18,0.04)]"
    >
      {items.map((item) => {
        const selected = item === value;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item)}
            className={`flex-1 rounded-full font-bold transition ${pad} ${
              selected
                ? "bg-white text-[var(--app-blue-500)] shadow-[var(--app-shadow-1)]"
                : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function Tag({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`ch-pill ${active ? "bg-[var(--app-blue-50)] text-[var(--app-blue-500)]" : ""}`}
    >
      {children}
    </span>
  );
}

export function ProgressLine({ value, color = "var(--app-success)" }: { value: number; color?: string }) {
  return (
    <div className="ch-progress">
      <span style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function FeatureListCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: string[];
}) {
  return (
    <article className="ch-soft-card p-5">
      <h3 className="text-[16px] font-bold text-[var(--app-text-primary)]">{title}</h3>
      {subtitle ? <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">{subtitle}</p> : null}
      <ul className="mt-4 space-y-2 text-[13px] leading-5 text-[var(--app-text-secondary)]">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </article>
  );
}

export function FieldShell({
  label,
  value,
  icon,
  wide = false,
}: {
  label: string;
  value: string;
  icon: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "lg:col-span-2" : ""}>
      <span className="block text-[14px] font-black text-[var(--app-text-primary)]">{label}</span>
      <span className="mt-3 flex min-h-14 items-center gap-3 rounded-full border border-[var(--app-border)] bg-white/86 px-4 text-[14px] text-[var(--app-text-secondary)] shadow-[var(--app-shadow-0)]">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--app-bg-muted)] text-[13px]" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <span className="text-[11px] text-[var(--app-text-tertiary)]" aria-hidden>
          {wide ? "" : "v"}
        </span>
      </span>
    </label>
  );
}

export function SectionRow({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  /** When true, section starts expanded (uncontrolled). */
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <div className="border-t border-dashed border-[var(--app-border)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={`flex min-h-14 w-full items-center justify-between px-5 text-left text-[15px] font-black ${
          open ? "text-[var(--app-blue-500)]" : "text-[var(--app-text-primary)]"
        }`}
      >
        {label}
        <AppIcon name="chevron-down" className={`size-4 shrink-0 transition-transform ${open ? "-rotate-180" : ""}`} />
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
  );
}

/** Soft panel using theme accent / danger / success mixed into border and fill (replaces repeated `color-mix` blocks). */
export function MixPanel({
  variant = "accent",
  children,
  className = "",
}: {
  variant?: "accent" | "danger" | "success" | "muted";
  children: ReactNode;
  className?: string;
}) {
  const skin: Record<typeof variant, string> = {
    accent:
      "border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_06%,var(--app-bg-elevated))]",
    danger:
      "border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_08%,var(--app-bg-elevated))]",
    success:
      "border-[color-mix(in_srgb,var(--app-success)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-success)_08%,var(--app-bg-page))]",
    muted: "border-[var(--app-border)] bg-[var(--app-bg-muted)]/30",
  };
  return (
    <div className={`rounded-[var(--app-radius-lg)] border-[0.5px] border-solid p-5 ${skin[variant]} ${className}`}>
      {children}
    </div>
  );
}

/** Three-band skills layout: critical gaps, partial / emerging, strengths (spec: Skill gap page). */
export function SkillTriadBoard({
  critical,
  partial = [],
  strengths,
  criticalTitle = "Critical gaps",
  partialTitle = "Partial / emerging",
  strengthsTitle = "Strengths",
  emptyHint = "None listed for this band.",
  partialEmptyHint = "JD-fit does not emit a partial band yet — use gaps and strengths as your triage list.",
}: {
  critical: string[];
  partial?: string[];
  strengths: string[];
  criticalTitle?: string;
  partialTitle?: string;
  strengthsTitle?: string;
  emptyHint?: string;
  partialEmptyHint?: string;
}) {
  const col = (title: string, tone: "red" | "amber" | "green", items: string[], bandEmpty?: string) => (
    <div className="flex min-h-[140px] flex-col rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-page)] p-4">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${
          tone === "red"
            ? "text-[var(--app-danger)]"
            : tone === "amber"
              ? "text-[var(--app-warning)]"
              : "text-[var(--app-success)]"
        }`}
      >
        {title}
      </p>
      <ul className="mt-3 flex flex-1 flex-wrap content-start gap-2">
        {items.length ? (
          items.map((s) => (
            <li key={s}>
              <Tag active={tone === "green"}>{s}</Tag>
            </li>
          ))
        ) : (
          <li className="text-[12px] leading-relaxed text-[var(--app-text-tertiary)]">{bandEmpty ?? emptyHint}</li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {col(criticalTitle, "red", critical)}
      {col(partialTitle, "amber", partial ?? [], partialEmptyHint)}
      {col(strengthsTitle, "green", strengths)}
    </div>
  );
}

/** Compact metric pair for sidebars and callouts. */
export function InlineStatPair({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) {
  return (
    <div className="flex flex-wrap gap-6">
      <div>
        <div className="tabular-nums text-[28px] font-bold text-[var(--app-text-primary)]">{leftValue}</div>
        <div className="text-[11px] text-[var(--app-text-tertiary)]">{leftLabel}</div>
      </div>
      <div>
        <div className="tabular-nums text-[28px] font-bold text-[var(--app-text-primary)]">{rightValue}</div>
        <div className="text-[11px] text-[var(--app-text-tertiary)]">{rightLabel}</div>
      </div>
    </div>
  );
}

export function JobPickCard({
  favorite = false,
  title = "Project Manager",
  company = "HAYS",
  lead = "Outcomes First Group has renewed focus on their online customer experience...",
  salary = "£50,000",
  salarySuffix = "/year",
  tags = ["3 year exp", "Full time", "Office"],
  initial = "C",
}: {
  favorite?: boolean;
  title?: string;
  company?: string;
  lead?: string;
  salary?: string;
  salarySuffix?: string;
  tags?: string[];
  initial?: string;
}) {
  return (
    <article className="ch-soft-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-[#111827] text-[var(--app-accent)]">{initial}</span>
          <div>
            <h3 className="font-bold text-[var(--app-text-primary)]">{title}</h3>
            <p className="text-[13px] font-semibold text-[var(--app-accent)]">{company}</p>
          </div>
        </div>
        <AppIcon name={favorite ? "star-filled" : "star"} filled={favorite} className="size-5 text-[var(--app-accent)]" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
      <p className="mt-4 text-[14px] leading-5 text-[var(--app-text-primary)]">{lead}</p>
      <p className="mt-5 text-[20px] font-bold text-[var(--app-accent)]">
        {salary}{" "}
        <span className="text-[13px] font-medium text-[var(--app-text-secondary)]">{salarySuffix}</span>
      </p>
    </article>
  );
}

export function BottomActions() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link className="ch-soft-card flex min-h-12 items-center justify-center gap-2 font-semibold text-[var(--app-accent)] transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]" href="/app/planner">
        Next: Create Career Roadmap <AppIcon name="chevron-right" className="size-4" />
      </Link>
      <Link className="ch-soft-card flex min-h-12 items-center justify-center gap-2 font-semibold text-[var(--app-accent)] transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]" href="/app/skill-gap-analysis">
        Next: Analyze Skill Gaps <AppIcon name="chevron-right" className="size-4" />
      </Link>
      <Link className="ch-soft-card flex min-h-12 items-center justify-center gap-2 font-semibold text-[var(--app-accent)] transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]" href="/app/copilot">
        Next: Get Guidance <AppIcon name="chevron-right" className="size-4" />
      </Link>
    </div>
  );
}
