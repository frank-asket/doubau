"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo } from "react";

type Tone = "green" | "red" | "blue";

const toneStroke: Record<Tone, string> = {
  green: "var(--app-success)",
  red: "var(--app-danger)",
  blue: "var(--app-blue-500)",
};

const toneFill: Record<Tone, string> = {
  green: "rgb(32, 209, 125)",
  red: "rgb(239, 68, 68)",
  blue: "rgb(52, 142, 246)",
};

function chartPoints(values: number[], w: number, h: number, padX: number, padY: number) {
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;
  const innerW = w - 2 * padX;
  const innerH = h - 2 * padY;
  return values.map((v, i) => {
    const x = padX + (values.length > 1 ? (i / (values.length - 1)) * innerW : innerW / 2);
    const y = padY + innerH - ((v - minV) / span) * innerH;
    return { x, y };
  });
}

/** Smooth cubic path through points (analytics-style, not jagged). */
function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function MetricSparkline({
  values,
  tone,
  drawDelay = 0,
}: {
  values: number[];
  tone: Tone;
  drawDelay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const rawId = useId().replace(/:/g, "");
  const gradId = `msf-${rawId}`;

  const w = 220;
  const h = 52;
  const padX = 3;
  const padY = 5;

  const { linePath, areaPath, last } = useMemo(() => {
    if (values.length < 2) {
      return { linePath: "", areaPath: "", last: null as { x: number; y: number } | null };
    }
    const pts = chartPoints(values, w, h, padX, padY);
    const linePath = smoothLinePath(pts);
    const y0 = padY + (h - 2 * padY);
    const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${y0} L ${pts[0].x} ${y0} Z`;
    return { linePath, areaPath, last: pts[pts.length - 1] };
  }, [values]);

  if (values.length < 2 || !linePath) {
    return (
      <div
        className="h-[52px] w-full max-w-[220px] rounded-xl bg-[var(--app-bg-muted)] ring-1 ring-[var(--app-border)]"
        aria-hidden
      />
    );
  }

  const strokeColor = toneStroke[tone];
  const fillRgb = toneFill[tone];
  const clipId = `ms-clip-${rawId}`;
  /** Left-to-right reveal matches API order (oldest sample → newest). */
  const revealDuration = reduceMotion ? 0 : 0.82;
  const revealEase = [0.22, 1, 0.36, 1] as const;
  const revealDoneAt = drawDelay + revealDuration;

  return (
    <svg
      className="h-[52px] w-full max-w-[220px]"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillRgb} stopOpacity="0.2" />
          <stop offset="85%" stopColor={fillRgb} stopOpacity="0.04" />
          <stop offset="100%" stopColor={fillRgb} stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <motion.rect
            x={0}
            y={0}
            height={h}
            fill="white"
            initial={{ width: reduceMotion ? w : 0 }}
            animate={{ width: w }}
            transition={{
              duration: revealDuration,
              delay: reduceMotion ? 0 : drawDelay,
              ease: revealEase,
            }}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {last ? (
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={3.5}
          fill="var(--app-bg-elevated)"
          stroke={strokeColor}
          strokeWidth={2}
          initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: reduceMotion ? 0 : revealDoneAt,
            duration: reduceMotion ? 0 : 0.22,
            ease: revealEase,
          }}
        />
      ) : null}
    </svg>
  );
}
