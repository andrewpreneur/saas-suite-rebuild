import { cn } from "@/lib/utils";

export interface FilterChipOption {
  id: string;
  label: string;
  count?: number;
}

/**
 * A row of filter chips with counts. One is always selected. Scrolls sideways on
 * phones instead of wrapping, so the list below never jumps.
 */
export function FilterChips({
  options,
  value,
  onChange,
  label,
  className,
  ...rest
}: {
  options: FilterChipOption[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the group, e.g. "Filter tickets". */
  label: string;
  className?: string;
  "data-tip-target"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]", className)}
      {...rest}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-brand bg-brand-subtle text-brand"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
            {option.count != null ? (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5",
                  active ? "bg-brand text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
