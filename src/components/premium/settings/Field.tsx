import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A labelled form field: label above the control, optional hint below. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A setting that is a single switch: label and description left, control right. */
export function ToggleRow({
  label,
  htmlFor,
  description,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[44px] min-w-0 items-center justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** The footer of a section: a hairline, then that section's one Save on the right. */
export function SectionFooter({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">{note}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center [&>button]:h-11 sm:[&>button]:h-10">{children}</div>
    </div>
  );
}
