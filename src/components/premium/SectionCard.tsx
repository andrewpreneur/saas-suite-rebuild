import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard content card: optional icon chip, title, one-line description,
 * an actions slot on the right, then the body. Use it instead of hand-built
 * card headers so every screen has the same rhythm.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  as: Heading = "h2",
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "h2" | "h3";
}) {
  return (
    <section className={cn("px-surface p-4 sm:p-6", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <Heading className="text-base font-semibold text-foreground">{title}</Heading> : null}
              {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className={cn(title || actions ? "mt-4" : "", bodyClassName)}>{children}</div> : null}
    </section>
  );
}
