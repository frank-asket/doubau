"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { MetricSparkline } from "@/components/dashboard/MetricSparkline";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type Tone = "green" | "red" | "blue";

export function HeroMetricCard({
  title,
  value,
  unit,
  delta,
  tone = "green",
  icon = "circle",
  sparkline,
  staggerIndex,
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
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const drawDelay = 0.14 + staggerIndex * 0.055;

  return (
    <motion.section
      className="ch-panel p-5"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.48,
        delay: reduceMotion ? 0 : staggerIndex * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
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
      <div className="mt-7 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
        <MetricSparkline values={sparkline} tone={tone} drawDelay={drawDelay} />
        <p className="text-[13px] leading-5 text-[var(--app-text-secondary)]">
          {children ??
            "Earlier samples on the left, today on the right. The curve is anchored to your recent baseline and current reading."}
        </p>
      </div>
    </motion.section>
  );
}
