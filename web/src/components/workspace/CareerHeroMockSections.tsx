import Link from "next/link";
import type { ReactNode } from "react";

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

export function SegmentedTabs({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-[var(--app-bg-muted)] p-1">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={`min-h-10 flex-1 rounded-full px-5 text-[14px] font-semibold transition ${
            item === active
              ? "bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-1)]"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function Tag({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`ch-pill ${active ? "bg-[var(--app-blue-50)] text-[var(--app-accent)]" : ""}`}
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

export function JobPickCard({ favorite = false }: { favorite?: boolean }) {
  return (
    <article className="ch-soft-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-[#111827] text-[var(--app-accent)]">C</span>
          <div>
            <h3 className="font-bold text-[var(--app-text-primary)]">Project Manager</h3>
            <p className="text-[13px] font-semibold text-[var(--app-accent)]">HAYS</p>
          </div>
        </div>
        <AppIcon name={favorite ? "star-filled" : "star"} filled={favorite} className="size-5 text-[var(--app-accent)]" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tag>3 year exp</Tag>
        <Tag>Full time</Tag>
        <Tag>Office</Tag>
      </div>
      <p className="mt-4 text-[14px] leading-5 text-[var(--app-text-primary)]">
        Outcomes First Group has renewed focus on their online customer experience...
      </p>
      <p className="mt-5 text-[20px] font-bold text-[var(--app-accent)]">£50,000 <span className="text-[13px] font-medium text-[var(--app-text-secondary)]">/year</span></p>
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
