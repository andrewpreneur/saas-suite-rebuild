import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One setting inside a SectionCard: a label, a sentence that says what turning it
 * on does, and the control on the right. Stack several with `divide-y`.
 */
export function SettingRow({
  title,
  description,
  htmlFor,
  control,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Id of the control, so clicking the title toggles it. */
  htmlFor?: string;
  control?: ReactNode;
  /** Extra content shown under the row (fields revealed by the switch). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-4 first:pt-0 last:pb-0", className)}>
      <div className="flex min-h-11 items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
            {title}
          </label>
          {description ? (
            <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {control ? <div className="flex shrink-0 items-center pt-0.5">{control}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
