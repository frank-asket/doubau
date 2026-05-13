"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { MetricSparkline } from "@/components/dashboard/MetricSparkline";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type Tone = "green" | "red" | "blue";

export type DashboardMetricPalette = "peach" | "blush" | "sky" | "cream";

export function HeroMetricCard({
  title,
  value,
  unit,
  delta,
  tone = "green",
  icon = "circle",
  sparkline,
  staggerIndex,
  palette = "peach",
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: Tone;
  icon?: AppIconName;
  sparkline: number[];
  staggerIndex: number;
  palette?: DashboardMetricPalette;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const drawDelay = 0.14 + staggerIndex * 0.055;

  const surface = `dashboard-metric-card dashboard-metric-card--${palette}`;

  return (
    <motion.section
      className={`${surface} p-6 sm:p-7`}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.48,
        delay: reduceMotion ? 0 : staggerIndex * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-secondary)]">{title}</h2>
      <div className="mt-6 flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/88 text-[var(--app-accent)] shadow-[0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-white/90">
          <AppIcon name={icon} className="size-[22px]" />
        </span>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="tabular-nums text-[34px] font-black tracking-[-0.045em] text-[var(--app-text-primary)] sm:text-[38px]">
            {value}
          </span>
          {unit ? <span className="text-[13px] font-semibold text-[var(--app-text-secondary)]">{unit}</span> : null}
          {delta ? (
            <span
              className={`text-[13px] font-bold ${
                tone === "red"
                  ? "text-[var(--app-danger)]"
                  : tone === "blue"
                    ? "text-[var(--app-text-secondary)]"
                    : "text-[var(--app-success)]"
              }`}
            >
              {delta}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
        <MetricSparkline
          key={sparkline.join("-")}
          values={sparkline}
          tone={tone}
          drawDelay={drawDelay}
        />
        <p className="text-[13px] leading-[1.55] text-[var(--app-text-secondary)]">
          {children ??
            "Earlier samples on the left, today on the right. The curve is anchored to your recent baseline and current reading."}
        </p>
      </div>
    </motion.section>
  );
}
