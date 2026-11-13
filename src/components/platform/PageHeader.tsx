import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { MoreMenu, type MoreMenuItem } from "@/components/premium/MoreMenu";

/**
 * Every platform page uses the same header: an optional eyebrow, one title, one
 * subheadline, and the page's actions on the right. The title is the page's only h1.
 *
 * Keep the right side to ONE button (the page's primary action). Everything
 * else a page can do goes in `more`, which renders as a single "..." menu.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  more,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
  more?: MoreMenuItem[];
}) {
  const hasMore = more && more.length > 0;
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
      {actions || hasMore ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {hasMore ? <MoreMenu items={more} /> : null}
        </div>
      ) : null}
    </motion.header>
  );
}
