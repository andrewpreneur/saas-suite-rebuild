import { useEffect, type HTMLAttributes, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

import darkBanner from "@/assets/saassuite-dark-banner.png.asset.json";
import { cn } from "@/lib/utils";
// Side effect: scopes the design-system tokens (html.ds-ui). Entry routes load outside the app shell.
import "@/lib/uiVersion";
import { EntryBackdrop } from "./EntryBackdrop";

interface EntryShellProps {
  /** The page's one h1. */
  title: ReactNode;
  description?: ReactNode;
  /** Icon or status mark shown above the title. */
  mark?: ReactNode;
  /** Back control. Rendered top-left of the card. */
  back?: ReactNode;
  /** Quiet line under the card (for example the link to the other auth page). */
  footer?: ReactNode;
  children?: ReactNode;
  /** Extra attributes for the card itself (data-testid, data-mode). */
  cardProps?: HTMLAttributes<HTMLElement> & Record<`data-${string}`, string | undefined>;
  className?: string;
  wide?: boolean;
}

/**
 * The one layout for every entry page: banner logo, a calm centered card, soft brand backdrop.
 * It never animates the card in, so the form is usable on first paint.
 */
export function EntryShell({ title, description, mark, back, footer, children, cardProps, className, wide }: EntryShellProps) {
  const { className: cardClassName, ...restCard } = cardProps ?? {};
  // Same body class the app shell sets, so type and brand remaps match the rest of the product.
  useEffect(() => {
    const had = document.body.classList.contains("ds-app");
    document.body.classList.add("ds-app");
    return () => {
      if (!had) document.body.classList.remove("ds-app");
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div className="px-canvas relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-8 sm:py-12">
        <EntryBackdrop />
        <main className={cn("relative z-10 w-full", wide ? "max-w-lg" : "max-w-[26rem]", className)}>
          <div className="mb-6 flex justify-center">
            <img src={darkBanner.url} alt="SaaSSuite" className="h-8 w-auto" />
          </div>
          <section
            {...restCard}
            className={cn("relative rounded-xl border border-border/60 bg-card p-6 shadow-raised sm:p-8", cardClassName)}
          >
            {back ? (
              <div className="-ml-2 -mt-2 mb-2 flex [&>button]:static [&>button]:m-0 [&>button]:h-9">{back}</div>
            ) : null}
            <header className="mb-6 text-center">
              {mark ? <div className="mb-4 flex justify-center">{mark}</div> : null}
              <h1 className="text-h3 text-balance text-foreground">{title}</h1>
              {description ? <p className="mt-2 text-small text-pretty text-muted-foreground">{description}</p> : null}
            </header>
            {children}
          </section>
          {footer ? <div className="mt-6 text-center text-small text-muted-foreground">{footer}</div> : null}
        </main>
      </div>
    </MotionConfig>
  );
}

export default EntryShell;
