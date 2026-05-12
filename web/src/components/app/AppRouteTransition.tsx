"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const VISIBLE = { opacity: 1, y: 0 };

export function AppRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={reduced ? VISIBLE : { opacity: 0, y: 10 }}
        animate={VISIBLE}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }
        }
        className="min-h-0 w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
