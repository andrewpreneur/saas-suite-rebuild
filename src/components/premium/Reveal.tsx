import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { riseItem, staggerParent } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Staggered page-load reveal: wrap a grid or stack in <Reveal> and each child in
 * <RevealItem>. One orchestrated moment per page; keep it to about six items.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={riseItem} className={cn("min-w-0", className)}>
      {children}
    </motion.div>
  );
}
