import type { ReactNode } from "react";
import { newUi } from "@/lib/uiVersion";

/**
 * Every platform page uses the same header: a title and one subheadline.
 * No info-icon tooltip.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className={newUi ? "text-h3 text-foreground sm:text-h2" : "text-2xl font-bold text-foreground"}>{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
