import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Building blocks for one setting's own page (see `SettingPages` in
 * `premium/SettingList`). The page is a single card, so these never draw a
 * card of their own: a status line with the page's one button, hairline
 * sections, and a disclosure for the things most people never open.
 */

const DOT = {
  on: "bg-success",
  off: "bg-muted-foreground/40",
  pending: "bg-warning",
  error: "bg-destructive",
} as const;

/** What it is set to right now, in plain words, with the page's primary button on the right. */
export function StatusRow({
  tone = "off",
  label,
  detail,
  children,
  className,
  inline,
}: {
  tone?: keyof typeof DOT;
  label: ReactNode;
  /** One sentence. */
  detail?: ReactNode;
  /** The one primary button, then a MoreMenu for everything else. */
  children?: ReactNode;
  className?: string;
  /** Keep the actions beside the text on phones too. Use when the only action is a "..." menu. */
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 gap-4 sm:flex-row sm:items-center sm:justify-between",
        inline ? "items-start justify-between" : "flex-col",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={cn("mt-2 size-2.5 shrink-0 rounded-full", DOT[tone])} />
        <div className="min-w-0">
          <p role="status" className="break-words text-base font-semibold text-foreground">
            {label}
          </p>
          {detail ? <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** A group inside the page card: hairline above, small heading, optional one-line note. */
export function PageSection({
  title,
  description,
  children,
  className,
  first,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** The first block in the card has no hairline above it. */
  first?: boolean;
}) {
  return (
    <section className={cn(!first && "mt-6 border-t border-border/70 pt-5", className)}>
      {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className={cn(title || description ? "mt-3" : "")}>{children}</div>
    </section>
  );
}

/** Advanced or rarely needed things: closed until asked for. */
export function Disclosure({
  label,
  children,
  defaultOpen,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("mt-6 border-t border-border/70 pt-2", className)}>
      <CollapsibleTrigger className="group -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 text-left text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0">{label}</span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-1 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** An error that belongs to one field. Sits right under it. */
export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}
