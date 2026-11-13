import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Stat = { label: string; value: ReactNode; hint?: string; onClick?: () => void };

/**
 * A row of numbers in ONE slim card instead of four big ones. Use it when the
 * numbers are context for the page, not the reason the page exists.
 */
export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn(
        "px-surface grid grid-cols-2 divide-border/70 overflow-hidden max-sm:[&>*:nth-child(n+3)]:border-t sm:flex sm:divide-x",
        className,
      )}
    >
      {stats.map((stat) => {
        const body = (
          <>
            <dt className="truncate text-xs font-medium text-muted-foreground">{stat.label}</dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-foreground">{stat.value}</span>
              {stat.hint ? <span className="hidden truncate text-xs text-muted-foreground sm:inline">{stat.hint}</span> : null}
            </dd>
          </>
        );
        return stat.onClick ? (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className="min-w-0 flex-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-[hsl(var(--brand-subtle))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
          >
            {body}
          </button>
        ) : (
          <div key={stat.label} className="min-w-0 flex-1 px-4 py-3 sm:px-5">
            {body}
          </div>
        );
      })}
    </dl>
  );
}
