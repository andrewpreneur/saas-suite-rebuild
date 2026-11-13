import { ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterSelectOption {
  id: string;
  label: string;
  count?: number;
}

/**
 * One compact control in place of a row of filter chips. The trigger reads
 * "Open 3"; every other view, with its count, is one click away in the menu.
 */
export function FilterSelect({
  options,
  value,
  onChange,
  label,
  className,
  ...rest
}: {
  options: FilterSelectOption[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name, e.g. "Filter tickets". */
  label: string;
  className?: string;
  "data-tip-target"?: string;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <div className={cn("shrink-0", className)} {...rest}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-11 w-auto min-w-[8.5rem] gap-2 sm:h-10">
          <ListFilter className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{current?.label}</span>
              {current?.count != null ? (
                <span className="min-w-5 rounded-full bg-muted px-1.5 text-center text-xs font-semibold tabular-nums leading-5 text-muted-foreground">
                  {current.count}
                </span>
              ) : null}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="min-h-10">
              {option.label}
              {option.count != null ? (
                <span className="ml-2 tabular-nums text-muted-foreground">{option.count}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
