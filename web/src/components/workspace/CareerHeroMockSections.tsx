import Link from "next/link";
import type { ReactNode } from "react";

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
  icon = "●",
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: Tone;
  icon?: string;
  children?: ReactNode;
}) {
  return (
    <section className="ch-panel p-5">
      <h2 className="text-[17px] font-bold text-[var(--app-text-primary)]">{title}</h2>
      <div className="mt-7 flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--app-blue-50)] text-[var(--app-accent)]">
          {icon}
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

export function Gauge({ value, label, icon = "●" }: { value: number; label: string; icon?: string }) {
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
          <div className="text-[24px]">{icon}</div>
          <div className="tabular-nums text-[32px] font-bold text-[var(--app-text-primary)]">{value}</div>
          <div className="text-[14px] text-[var(--app-text-secondary)]">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function SegmentedTabs({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-[var(--app-bg-muted)] p-1 shadow-[inset_0_0_0_1px_rgba(17,22,18,0.04)]">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={`min-h-10 flex-1 rounded-full px-5 text-[14px] font-bold transition ${
            item === active
              ? "bg-white text-[var(--app-blue-500)] shadow-[var(--app-shadow-1)]"
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
  active = false,
  children,
}: {
  label: string;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="border-t border-dashed border-[var(--app-border)]">
      <button
        type="button"
        className={`flex min-h-14 w-full items-center justify-between px-5 text-left text-[15px] font-black ${
          active ? "text-[var(--app-blue-500)]" : "text-[var(--app-text-primary)]"
        }`}
      >
        {label}
        <span className="text-[12px]" aria-hidden>
          {active ? "^" : "v"}
        </span>
      </button>
      {active ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
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
        <span className="text-[22px] text-[var(--app-accent)]">{favorite ? "★" : "☆"}</span>
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
      <Link className="ch-soft-card flex min-h-12 items-center justify-center font-semibold text-[var(--app-accent)]" href="/app/planner">
        Next: Create Career Roadmap ›
      </Link>
      <Link className="ch-soft-card flex min-h-12 items-center justify-center font-semibold text-[var(--app-accent)]" href="/app/skill-gap-analysis">
        Next: Analyze Skill Gaps ›
      </Link>
      <Link className="ch-soft-card flex min-h-12 items-center justify-center font-semibold text-[var(--app-accent)]" href="/app/copilot">
        Next: Get AI Guidance ›
      </Link>
    </div>
  );
}
