import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Footer row for an EditorPanel in the hub pages. Leaves room on the right for
 * the floating assistant button, which sits above side panels, so it never
 * covers Save.
 */
export function PanelActions({ children, note, className }: { children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex w-full flex-wrap items-center justify-end gap-2 sm:pr-16", className)}>
      {note ? <span className="mr-auto min-w-0 text-sm text-muted-foreground" aria-live="polite">{note}</span> : null}
      {children}
    </div>
  );
}
