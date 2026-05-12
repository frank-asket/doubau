"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

const FM = "fm-motion";

const MotionLink = motion(Link);

/** DOM handlers that clash with Framer Motion props on `motion.*` components. */
type MotionDomConflicts =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd";

type ChromePrimaryButtonProps = Omit<ComponentPropsWithoutRef<"button">, MotionDomConflicts>;

export function ChromePrimaryButton({ className, type = "button", ...props }: ChromePrimaryButtonProps) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type={type}
      className={cn("ch-primary-button", FM, className)}
      whileHover={reduced ? undefined : { scale: 1.02 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 480, damping: 30 }}
      {...props}
    />
  );
}

type ChromePrimaryLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, MotionDomConflicts>;

export function ChromePrimaryLink({ className, ...props }: ChromePrimaryLinkProps) {
  const reduced = useReducedMotion();
  return (
    <MotionLink
      className={cn("ch-primary-button", FM, "inline-flex items-center justify-center gap-2", className)}
      whileHover={reduced ? undefined : { scale: 1.02 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 480, damping: 30 }}
      {...props}
    />
  );
}

type ChromeIconButtonProps = Omit<ComponentPropsWithoutRef<"button">, MotionDomConflicts>;

export function ChromeIconButton({ className, ...props }: ChromeIconButtonProps) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      className={cn("ch-icon-button", FM, className)}
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 560, damping: 26 }}
      {...props}
    />
  );
}

type ChromeIconLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, MotionDomConflicts>;

export function ChromeIconLink({ className, ...props }: ChromeIconLinkProps) {
  const reduced = useReducedMotion();
  return (
    <MotionLink
      className={cn("ch-icon-button", FM, className)}
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 560, damping: 26 }}
      {...props}
    />
  );
}
