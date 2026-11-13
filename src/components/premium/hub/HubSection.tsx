import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SectionCard's layout (icon chip, title, one-line description, actions, body) for
 * the hub editors, which also need a ref, `data-*` hooks and a dimmed "off" look.
 */
export const HubSection = forwardRef<
  HTMLElement,
  Omit<HTMLAttributes<HTMLElement>, "title"> & {
    title?: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
    /** The section is switched off: keep it readable but clearly quieter. */
    off?: boolean;
    bodyClassName?: string;
  }
>(function HubSection({ title, description, icon, actions, off, className, bodyClassName, children, ...rest }, ref) {
  return (
    <section
      ref={ref}
      {...rest}
      className={cn("px-surface min-w-0 p-4 transition-shadow duration-200 sm:p-6", off && "bg-muted/40 shadow-none", className)}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={cn("flex min-w-0 flex-1 basis-56 items-start gap-3", off && "opacity-60")}>
            {icon ? (
              <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children ? (
        <div className={cn(title || actions ? "mt-4" : "", off && "opacity-60", bodyClassName)}>{children}</div>
      ) : null}
    </section>
  );
});
