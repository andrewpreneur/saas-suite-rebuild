import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

/** Destructive actions live here, apart from everything else and last on the page. */
export function DangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-destructive/30 bg-card p-4 sm:p-6" aria-label="Danger zone">
      <p className="px-eyebrow mb-3 flex items-center gap-1.5 text-destructive">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        Danger zone
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </section>
  );
}
