import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** A switch with a visible On / Off word, so state never relies on color alone. */
export function OnOffSwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Show Create a New Contact". */
  label: string;
  id?: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <span className={cn("w-6 text-right text-xs font-medium tabular-nums", checked ? "text-foreground" : "text-muted-foreground")}>
        {checked ? "On" : "Off"}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </span>
  );
}

/** The quiet "add another" row used at the bottom of every hub list. */
export function AddRowButton({
  children,
  className,
  icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 text-sm font-medium text-muted-foreground transition-colors duration-150",
        "hover:border-brand/50 hover:bg-brand-subtle hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {icon ?? <Plus className="size-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** One row in a hub list: optional leading control, text, trailing actions. */
export function HubRow({
  leading,
  title,
  meta,
  trailing,
  off,
  className,
  ...rest
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  off?: boolean;
}) {
  return (
    <div
      {...rest}
      className={cn(
        "flex min-h-[52px] min-w-0 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors duration-150 hover:border-brand/30",
        className,
      )}
    >
      {leading}
      <div className={cn("min-w-0 flex-1", off && "opacity-55")}>
        <div className="line-clamp-2 break-words text-sm font-medium text-foreground sm:line-clamp-1">{title}</div>
        {meta ? <div className="truncate text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
    </div>
  );
}

/** Skeleton in the shape of a hub list. */
export function HubListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-[52px] items-center gap-3 rounded-md border border-border px-3">
          <div className="px-skeleton h-5 w-9 rounded-full" />
          <div className="px-skeleton h-4 rounded-sm" style={{ width: `${55 - i * 7}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a whole hub page: header, link bar, two cards. */
export function HubPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="px-skeleton h-8 w-56 rounded-sm" />
        <div className="px-skeleton h-4 w-96 max-w-full rounded-sm" />
      </div>
      <div className="px-skeleton h-16 w-full rounded-lg" />
      <div className="px-surface p-6">
        <div className="px-skeleton mb-4 h-5 w-40 rounded-sm" />
        <HubListSkeleton />
      </div>
    </div>
  );
}

/** Icon tile for EmptyState in the hub pages (token colors, 56px). */
export function HubEmptyIcon({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex size-14 items-center justify-center rounded-lg border border-brand/20 bg-brand-subtle text-brand [&_svg]:size-6"
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
