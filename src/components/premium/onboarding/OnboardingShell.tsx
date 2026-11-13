import { useEffect } from "react";
import type { ReactNode } from "react";
// Side effect: scopes the design-system tokens (html.ds-ui). Onboarding routes load outside the app shell.
import "@/lib/uiVersion";
import { AnimatePresence, motion } from "framer-motion";
import darkBanner from "@/assets/saassuite-dark-banner.png.asset.json";
import { SPRING_SOFT, slideStep } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Soft animated backdrop for onboarding only. The idea (three slow drifting
 * blurred blobs) comes from premium/21st/floating-gradient.tsx
 * (21st.dev "Floating Gradient" by @moumensoliman, demo id 19381), recolored
 * to the brand tokens and made a fixed, non-interactive layer.
 */
export function OnboardingBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-32 size-[20rem] rounded-full bg-brand/10 sm:size-[28rem] sm:bg-brand/15 blur-3xl"
        animate={{ x: [0, 80, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 top-1/4 size-[26rem] rounded-full bg-info/10 blur-3xl"
        animate={{ x: [0, -70, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/3 size-[30rem] rounded-full bg-brand/10 blur-3xl"
        animate={{ x: [0, 50, 0], y: [0, -60, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/** "Step n of m" with one animated segment per step. Earlier steps are clickable. */
export function StepRail({
  index,
  labels,
  onStepClick,
  noun = "Step",
  className,
}: {
  index: number;
  labels: string[];
  onStepClick?: (index: number) => void;
  noun?: string;
  className?: string;
}) {
  const total = labels.length;
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="px-eyebrow" aria-live="polite">
          {noun} {index + 1} of {total}
        </p>
        <p className="truncate text-small font-medium text-foreground">{labels[index]}</p>
      </div>
      <ol className="flex list-none items-center gap-1.5 p-0">
        {labels.map((label, i) => {
          const filled = i <= index;
          const canJump = !!onStepClick && i < index;
          const bar = (
            <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-border">
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-brand"
                initial={false}
                animate={{ scaleX: filled ? 1 : 0 }}
                transition={SPRING_SOFT}
              />
            </span>
          );
          return (
            <li key={label} className="flex-1" aria-current={i === index ? "step" : undefined}>
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(i)}
                  aria-label={`Go back to ${noun.toLowerCase()} ${i + 1}: ${label}`}
                  className="block w-full rounded-full py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {bar}
                </button>
              ) : (
                <span className="block py-2">
                  <span className="sr-only">
                    {noun} {i + 1}: {label}
                  </span>
                  {bar}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The full-screen onboarding frame: logo bar, progress rail, a centred column
 * for one decision, and a sticky action bar. Reads --copilot-dock-offset so the
 * column stays centred in the space beside a docked Copilot.
 */
export function OnboardingShell({
  rail,
  topRight,
  footer,
  children,
  width = "md",
}: {
  rail?: ReactNode;
  topRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: "md" | "lg";
}) {
  const column = width === "lg" ? "max-w-3xl" : "max-w-xl";
  // Same body class the app shell sets, so type and brand remaps match the rest of the product.
  useEffect(() => {
    const had = document.body.classList.contains("ds-app");
    document.body.classList.add("ds-app");
    return () => {
      if (!had) document.body.classList.remove("ds-app");
    };
  }, []);
  return (
    <div className="px-canvas relative flex min-h-screen flex-col lg:pr-[var(--copilot-dock-offset,0px)]">
      <OnboardingBackdrop />
      <header className="relative z-10 flex h-16 items-center justify-between gap-3 px-4 sm:px-8">
        <img src={darkBanner.url} alt="SaaSSuite" className="h-6 w-auto" />
        {topRight}
      </header>
      <main className="relative z-10 flex flex-1 flex-col px-4 pb-8 sm:px-8">
        <div className={cn("mx-auto flex w-full flex-1 flex-col", column)}>
          {rail ? <div className="pb-8 pt-2 sm:pt-4">{rail}</div> : null}
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </main>
      {footer ? (
        <footer className="px-glass sticky bottom-0 z-20 border-t border-border px-4 py-3 sm:px-8">
          <div className={cn("mx-auto flex w-full items-center gap-3", column)}>{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}

/** Direction-aware slide between steps. `stepKey` changes when the step changes. */
export function StepSlide({
  stepKey,
  direction,
  children,
  className,
}: {
  stepKey: string | number;
  direction: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={slideStep}
        initial="enter"
        animate="center"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Big friendly step heading. One per step. */
export function StepHeading({
  title,
  subtitle,
  as: Tag = "h1",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("mb-8", className)}>
      <Tag className="text-balance text-[1.75rem] font-bold leading-9 tracking-tight text-foreground sm:text-h1">
        {title}
      </Tag>
      {subtitle ? (
        <p className="mt-3 text-pretty text-body text-muted-foreground sm:text-body-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
