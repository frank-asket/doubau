"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";

const copilotSans = "font-[family-name:var(--font-copilot-sans),ui-sans-serif,system-ui,sans-serif]";

const STORAGE_KEY = "doubow-career-ai-dock-collapsed";

/**
 * Persistent Career AI Assistant — matches the floating card pattern from product mockups.
 * Hidden on the full Career Copilot page to avoid duplicating the primary chat surface.
 */
export function CareerAiAssistantDock() {
  const pathname = usePathname();
  const onCopilot = pathname === "/app/copilot";
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  if (!hydrated || onCopilot) return null;

  if (collapsed) {
    return (
      <div className="pointer-events-none fixed bottom-5 right-4 z-[60] flex justify-end sm:right-6">
        <motion.button
          type="button"
          onClick={() => persistCollapsed(false)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className={cn(
            "pointer-events-auto grid size-12 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-sidebar)] text-white shadow-[0_12px_40px_rgba(7,17,13,0.35)]",
            copilotSans,
          )}
          aria-label="Open Career AI Assistant"
        >
          <AppIcon name="sparkle" className="size-5 text-[var(--app-accent)]" />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-5 left-4 right-4 z-[60] flex flex-col items-stretch gap-2 sm:left-auto sm:right-6 sm:w-[min(360px,calc(100vw-3rem))]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className={cn(
          "pointer-events-auto overflow-hidden rounded-[22px] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[var(--app-bg-elevated)] shadow-[0_22px_60px_rgba(15,23,42,0.14)]",
          copilotSans,
        )}
      >
        <div className="relative bg-gradient-to-br from-[color-mix(in_srgb,var(--app-accent)_22%,#f4fbf7)] via-white to-[var(--app-bg-page)] px-4 pb-3 pt-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/80 bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-0)]">
              <AppIcon name="message-circle" className="size-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold leading-snug tracking-tight text-[var(--app-text-primary)]">
                Career AI Assistant
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">
                <AppIcon name="layers" className="size-3 text-[var(--app-accent)]" aria-hidden />
                Multi-agent · same engine as Career Copilot
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4 pt-1">
          <p className="text-[14px] font-semibold text-[var(--app-text-primary)]">Not sure where to head next?</p>
          <ul className="list-none space-y-2 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
            <li className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--app-accent)]" aria-hidden />
              <span>Get suggestions grounded in your goals, skills, and live job context.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--app-accent)]" aria-hidden />
              <span>Surface roles you might have missed and how to position for them.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--app-accent)]" aria-hidden />
              <span>Turn anxiety into a weekly plan you can actually execute.</span>
            </li>
          </ul>

          <Link
            href="/app/copilot"
            className="flex w-full min-h-11 items-center justify-center gap-2 rounded-[999px] bg-[var(--app-sidebar)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(7,17,13,0.22)] transition-[transform,background-color] hover:bg-[color-mix(in_srgb,var(--app-sidebar)_90%,#000)] active:scale-[0.98]"
          >
            <AppIcon name="message-circle" className="size-4 text-[var(--app-accent)]" aria-hidden />
            Open Career Copilot
          </Link>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Link
              href="/app/copilot"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--app-accent)] underline-offset-4 hover:underline"
            >
              Next: Get AI guidance
              <AppIcon name="chevron-right" className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => persistCollapsed(true)}
              className="grid size-9 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-bg-page)] text-[var(--app-text-secondary)] transition-colors hover:bg-[var(--app-bg-muted)]"
              aria-label="Minimize Career AI Assistant"
            >
              <AppIcon name="chevron-down" className="size-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
