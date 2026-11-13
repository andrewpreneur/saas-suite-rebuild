import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * Every platform page uses the same header: an optional eyebrow, one title, one
 * subheadline, and the page's actions on the right. The title is the page's only h1.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div className="min-w-0">
        {eyebrow ? <p className="px-eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-h3 tracking-tight text-foreground sm:text-h2">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.header>
  );
}
