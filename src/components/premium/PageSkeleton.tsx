// Adapted from 21st.dev: "Skeleton shimmer" by motiondotdev (https://21st.dev). Their moving-highlight block, laid out in the shape of our pages.
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const SHIMMER =
  "linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--border)) 50%, hsl(var(--muted)) 75%)";

/** One shimmering block. Give it the size of the thing it stands in for. */
export function ShimmerBlock({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={cn("rounded-lg", className)}
      style={{ backgroundImage: SHIMMER, backgroundSize: "200% 100%" }}
      animate={reduce ? undefined : { backgroundPosition: ["200% 0", "-200% 0"] }}
      transition={{ duration: 1.6, ease: "linear", repeat: Infinity, delay }}
    />
  );
}

/**
 * What a page shows while its code or data loads: a title, a sentence, a strip
 * and a card of rows, in the same places the real page puts them, so nothing
 * jumps when the content arrives. `variant="bare"` drops the padding for use
 * inside an existing page column.
 */
export function PageSkeleton({ rows = 5, variant = "page" }: { rows?: number; variant?: "page" | "bare" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("w-full space-y-6", variant === "page" && "mx-auto max-w-[1400px] px-4 py-6 md:px-14")}
    >
      <span className="sr-only">Loading</span>
      <div className="space-y-3">
        <ShimmerBlock className="h-3 w-24" />
        <ShimmerBlock className="h-8 w-64 max-w-[70%]" delay={0.05} />
        <ShimmerBlock className="h-4 w-96 max-w-full" delay={0.1} />
      </div>
      <ShimmerBlock className="h-16 w-full rounded-[var(--radius)]" delay={0.15} />
      <div className="px-surface divide-y divide-border/70 overflow-hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-5 py-4">
            <ShimmerBlock className="size-9 shrink-0 rounded-xl" delay={0.2 + index * 0.05} />
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-3.5 w-40 max-w-[50%]" delay={0.2 + index * 0.05} />
              <ShimmerBlock className="h-3 w-72 max-w-[80%]" delay={0.25 + index * 0.05} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
