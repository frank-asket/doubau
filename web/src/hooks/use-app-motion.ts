"use client";

import { useReducedMotion } from "framer-motion";

/** Spring presets tuned for UI chrome — disable scale when user prefers reduced motion. */
export function useAppMotionSprings() {
  const reduced = useReducedMotion();

  return {
    reduced: Boolean(reduced),
    tap: reduced ? undefined : { scale: 0.97 },
    hoverSubtle: reduced ? undefined : { scale: 1.015 },
    hoverLink: reduced ? undefined : { x: 3 },
    spring: { type: "spring" as const, stiffness: 520, damping: 28 },
    springSoft: { type: "spring" as const, stiffness: 380, damping: 32 },
    fade: reduced ? { duration: 0 } : { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const },
  };
}
