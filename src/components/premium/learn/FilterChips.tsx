import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/**
 * A single-choice filter shown as chips. Every option stays visible so people
 * recognise the choices instead of opening a menu to find them.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-150 sm:h-9 sm:px-3",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4",
              active
                ? "border-brand bg-brand-subtle text-brand"
                : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
            {typeof option.count === "number" ? (
              <span className={cn("text-xs tabular-nums", active ? "text-brand" : "text-muted-foreground")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
