import type { ReactNode } from "react";
import NumberTicker from "@/components/premium/21st/number-ticker";
import { cn } from "@/lib/utils";

/** One number that counts up, a clear label, and a quiet line of context. */
export function KpiCard({
  icon,
  label,
  value,
  hint,
  loading,
  prefix,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint?: ReactNode;
  loading?: boolean;
  prefix?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-surface flex flex-col items-start gap-3 p-4 sm:flex-row", className)}>
      <span className="px-icon-chip hidden shrink-0 sm:inline-grid [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-5 text-muted-foreground">{label}</p>
        {loading ? (
          <div className="px-skeleton mt-1 h-8 w-12" role="status" aria-label={`Loading ${label}`} />
        ) : (
          <p className="text-h3 font-semibold tabular-nums tracking-tight text-foreground">
            {prefix}
            <NumberTicker
              key={value}
              from={0}
              target={value}
              transition={{ duration: 0.8, type: "tween", ease: [0.16, 1, 0.3, 1] }}
            />
          </p>
        )}
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
