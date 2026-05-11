"use client";

import { useSyncExternalStore } from "react";

/**
 * Single source of truth for “wide enough to expand roadmap drawers by default”.
 * Matches Tailwind `xl` (1280px). Change only here if you switch tokens (e.g. `lg` 1024 or `2xl` 1536).
 */
export const SIDEBAR_XL_MIN_PX = 1280;

const SIDEBAR_EXPAND_QUERY = `(min-width: ${SIDEBAR_XL_MIN_PX}px)`;

function subscribeSidebarExpand(onChange: () => void) {
  const mq = window.matchMedia(SIDEBAR_EXPAND_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSidebarExpandSnapshot() {
  return window.matchMedia(SIDEBAR_EXPAND_QUERY).matches;
}

/**
 * Viewport at or above {@link SIDEBAR_XL_MIN_PX} (Tailwind `xl`). Server snapshot is `false` (mobile-first).
 */
export function useMinWidthXl(): boolean {
  return useSyncExternalStore(subscribeSidebarExpand, getSidebarExpandSnapshot, () => false);
}

/**
 * `prefers-reduced-motion: reduce` — skip chevron transition when true.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
