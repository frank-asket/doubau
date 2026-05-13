"use client";

import { motion, useReducedMotion } from "framer-motion";

export type ApplicationTrendsChartData = {
  buckets: {
    label: string;
    awaiting_response: number;
    response_received: number;
    rejected: number;
  }[];
  window_total: number;
  window_delta_percent: number;
  trend: "up" | "down" | "flat";
};

const OUTCOME_COLORS = {
  awaiting: "#64748b",
  response: "#0f766e",
  rejected: "#a63d52",
} as const;

function formatPeriodDeltaLabel(deltaPercent: number, trend: ApplicationTrendsChartData["trend"]): string {
  if (trend === "flat") return "Flat vs prior 31-day window";
  const sign = deltaPercent > 0 ? "+" : "";
  const dir = trend === "up" ? "Up" : "Down";
  return `${dir} ${sign}${Math.abs(deltaPercent)}% vs prior 31 days`;
}

function niceYAxisMax(n: number): number {
  if (n <= 0) return 1;
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  const exp = 10 ** Math.floor(Math.log10(n));
  const f = n / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function segmentHeightsPx(
  awaiting: number,
  response: number,
  rejected: number,
  total: number,
  columnPx: number,
): { awaiting: number; response: number; rejected: number } {
  if (!total || columnPx <= 0) return { awaiting: 0, response: 0, rejected: 0 };
  const ha = Math.floor((awaiting / total) * columnPx);
  const hr = Math.floor((response / total) * columnPx);
  const hj = columnPx - ha - hr;
  return { awaiting: ha, response: hr, rejected: Math.max(0, hj) };
}

export function ApplicationTrendsChart({ data }: { data: ApplicationTrendsChartData }) {
  const reduceMotion = useReducedMotion();
  const bucketTotals = data.buckets.map(
    (p) => p.awaiting_response + p.response_received + p.rejected,
  );
  const dataMax = Math.max(0, ...bucketTotals);
  const yMax = niceYAxisMax(dataMax);
  const hasActivity = bucketTotals.some((t) => t > 0);

  const deltaStr = formatPeriodDeltaLabel(data.window_delta_percent, data.trend);
  const deltaClass =
    data.trend === "up"
      ? "text-[#0f766e]"
      : data.trend === "down"
        ? "text-[#a63d52]"
        : "text-[var(--app-text-tertiary)]";

  const plotH = 216;
  const yTicks = [yMax, Math.round(yMax / 2), 0];

  const legend = (
    <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 border-t border-[color-mix(in_srgb,var(--app-border)_75%,transparent)] pt-5 text-[12px] font-semibold text-[var(--app-text-secondary)]">
      <li className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full ring-1 ring-black/[0.06]"
          style={{ backgroundColor: OUTCOME_COLORS.awaiting }}
          aria-hidden
        />
        Awaiting response
      </li>
      <li className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full ring-1 ring-black/[0.06]"
          style={{ backgroundColor: OUTCOME_COLORS.response }}
          aria-hidden
        />
        Response received
      </li>
      <li className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full ring-1 ring-black/[0.06]"
          style={{ backgroundColor: OUTCOME_COLORS.rejected }}
          aria-hidden
        />
        Rejected
      </li>
    </ul>
  );

  return (
    <section className="dashboard-chart-card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[color-mix(in_srgb,var(--app-border)_75%,transparent)] pb-6">
        <div className="min-w-0 space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-secondary)]">
            Application outcomes
          </h2>
          <p className="max-w-xl text-[14px] leading-relaxed text-[var(--app-text-secondary)]">
            Stacked counts by calendar day band (last 31 days). Segments sum to applications created in each band; split
            reflects current pipeline status.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">
            Window total
          </p>
          <motion.p
            className="mt-1.5 tabular-nums text-[30px] font-black leading-none tracking-[-0.03em] text-[var(--app-text-primary)]"
            initial={reduceMotion ? false : { opacity: 0.35 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.2 }}
          >
            {data.window_total}
          </motion.p>
          <p className={`mt-2 text-[12px] font-medium tabular-nums ${deltaClass}`}>{deltaStr}</p>
        </div>
      </div>

      {legend}

      {hasActivity ? (
        <figure className="mt-6">
          <div className="flex gap-0 sm:gap-1">
            <div
              className="flex w-9 shrink-0 flex-col justify-between text-right text-[10px] font-medium tabular-nums leading-none text-[var(--app-text-tertiary)] sm:w-10 sm:text-[11px]"
              style={{ height: plotH }}
              aria-hidden
            >
              <span>{yMax}</span>
              <span>{yTicks[1]}</span>
              <span>0</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="relative" style={{ height: plotH }}>
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col justify-between"
                  aria-hidden
                >
                  <div className="h-px w-full bg-[var(--app-border)]" />
                  <div className="h-px w-full bg-[var(--app-border)]" />
                  <div className="h-px w-full bg-[var(--app-border-strong)]" />
                </div>
                <div
                  className="relative z-[1] flex h-full items-end gap-1.5 sm:gap-2"
                  role="group"
                  aria-label="Application outcome stacks by day band"
                >
                  {data.buckets.map((point, bucketIndex) => {
                    const total = point.awaiting_response + point.response_received + point.rejected;
                    const columnPx =
                      total > 0 ? Math.max(4, Math.round((total / yMax) * plotH)) : 0;
                    const { awaiting: ha, response: hr, rejected: hj } = segmentHeightsPx(
                      point.awaiting_response,
                      point.response_received,
                      point.rejected,
                      total,
                      columnPx,
                    );

                    const heightShare = columnPx > 0 ? columnPx / plotH : 0;
                    const barDuration = reduceMotion ? 0 : 0.42 + heightShare * 0.38;
                    const barDelay = reduceMotion ? 0 : bucketIndex * 0.055;

                    return (
                      <div
                        key={point.label}
                        className="flex min-w-0 flex-1 flex-col items-stretch justify-end"
                      >
                        <motion.div
                          className="mx-auto flex w-full max-w-[52px] flex-col justify-end overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-bg-muted)_65%,white)] ring-1 ring-[color-mix(in_srgb,var(--app-border)_70%,white)]"
                          style={{ height: columnPx }}
                          initial={reduceMotion ? false : { height: 0 }}
                          animate={{ height: columnPx }}
                          transition={{
                            duration: barDuration,
                            delay: barDelay,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          title={`${total} applications · ${point.awaiting_response} awaiting · ${point.response_received} response · ${point.rejected} rejected`}
                        >
                          {point.awaiting_response > 0 ? (
                            <div
                              className="w-full shrink-0 border-t border-white/[0.18] first:border-t-0"
                              style={{
                                height: ha,
                                backgroundColor: OUTCOME_COLORS.awaiting,
                              }}
                            />
                          ) : null}
                          {point.response_received > 0 ? (
                            <div
                              className="w-full shrink-0 border-t border-white/[0.18]"
                              style={{
                                height: hr,
                                backgroundColor: OUTCOME_COLORS.response,
                              }}
                            />
                          ) : null}
                          {point.rejected > 0 ? (
                            <div
                              className="w-full shrink-0 border-t border-white/[0.18]"
                              style={{
                                height: hj,
                                backgroundColor: OUTCOME_COLORS.rejected,
                              }}
                            />
                          ) : null}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-8 gap-1.5 sm:gap-2">
                {data.buckets.map((point, i) => {
                  const total = point.awaiting_response + point.response_received + point.rejected;
                  return (
                    <motion.div
                      key={`x-${point.label}`}
                      className="min-w-0 text-center"
                      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.28,
                        delay: reduceMotion ? 0 : 0.12 + i * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <p className="tabular-nums text-[12px] font-semibold text-[var(--app-text-primary)]">{total}</p>
                      <p className="mt-1 truncate text-[10px] font-medium text-[var(--app-text-tertiary)] sm:text-[11px]">
                        {point.label}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
          <figcaption className="sr-only">
            Stacked bar chart of application outcomes over eight day ranges in the last month. Maximum axis value{" "}
            {yMax}.
          </figcaption>
        </figure>
      ) : (
        <div className="mt-6 flex min-h-[240px] items-center justify-center rounded-[32px] border border-dashed border-[color-mix(in_srgb,var(--app-border)_85%,transparent)] bg-white/35 px-6 text-center backdrop-blur-sm">
          <p className="max-w-md text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
            No applications recorded in this window. Data will appear when roles are saved from Job Discovery and show up
            in your tracker.
          </p>
        </div>
      )}
    </section>
  );
}
