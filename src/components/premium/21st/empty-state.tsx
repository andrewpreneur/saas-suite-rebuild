// Source: 21st.dev "Empty State" by @wensity (demo id 27575). Adapted for the SaaSSuite design system.
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */

export interface EmptyStateProps {
  /** Large icon or illustration displayed above the text. */
  icon?: React.ReactNode;
  /** Primary heading. */
  title: string;
  /** Supporting description beneath the title. */
  description?: string;
  /** Optional action slot. Pass a single button, a button group, or an input. */
  action?: React.ReactNode;
  /** Optional footer slot rendered below the action (links, secondary text). */
  footer?: React.ReactNode;
  /** Additional class name on the root wrapper. */
  className?: string;
}

/* ─── EmptyState ────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  footer,
  className,
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      data-wensity-primitive=""
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 360,
            damping: 28,
            mass: 0.6,
          }}
        >
          {icon}
        </motion.div>
      )}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </p>
        {description && (
          <p className="max-w-[22rem] text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      )}
      {footer && <div>{footer}</div>}
    </div>
  );
}

/* ─── Illustrations (icon slots) ────────────────────────────── */

/** A subtle, larger icon container for the illustration variant. */
export function EmptyStateIllustration({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-16 items-center justify-center rounded-xl",
        "border border-border",
        "px-brand-wash",
        "text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default EmptyState;
