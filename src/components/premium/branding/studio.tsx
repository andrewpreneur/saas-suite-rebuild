// Branding studio building blocks. The step rail borrows the sliding-pill idea of
// premium/21st/animated-tabs.tsx (21st.dev "Animated Tabs" by @educalvolpz) and adds
// step numbers, done checks, locks and test ids, which that component does not expose.
import type { KeyboardEvent, ReactNode } from "react";
import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, SPRING_SNAPPY, popIn } from "@/lib/motion";

export type StudioStep = {
  id: string;
  label: string;
  hint: string;
  done?: boolean;
  locked?: boolean;
};

/** The four-step rail: number, label, one-line hint, and a check once a step is set up. */
export function StudioSteps({
  steps,
  active,
  onChange,
  label,
  testIdPrefix,
  panelId,
}: {
  steps: StudioStep[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  testIdPrefix: string;
  panelId: string;
}) {
  const layoutId = useId();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % steps.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + steps.length) % steps.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = steps.length - 1;
    else return;
    event.preventDefault();
    onChange(steps[next].id);
    document.getElementById(`${testIdPrefix}-${steps[next].id}`)?.focus();
  };
  return (
    <div className="w-full min-w-0 [container-type:inline-size]">
    <div
      role="tablist"
      aria-label={label}
      className="px-surface grid w-full grid-cols-4 gap-1 p-1.5 [&>button]:!min-w-0 [&>button]:!flex-1"
    >
      {steps.map((step, index) => {
        const selected = step.id === active;
        return (
          <button
            key={step.id}
            id={`${testIdPrefix}-${step.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            aria-label={`${index + 1} ${step.label}`}
            tabIndex={selected ? 0 : -1}
            data-testid={`${testIdPrefix}-${step.id}`}
            onClick={() => onChange(step.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative flex min-h-[44px] min-w-0 flex-col items-center gap-1.5 rounded-md px-1.5 py-2 text-center transition-colors [@container(min-width:520px)]:flex-row [@container(min-width:520px)]:gap-3 [@container(min-width:520px)]:px-3 [@container(min-width:520px)]:py-2.5 [@container(min-width:520px)]:text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-md bg-brand-subtle ring-1 ring-inset ring-brand/20"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                selected
                  ? "bg-brand text-brand-foreground shadow-brand"
                  : step.done
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              <AnimatePresence mode="wait" initial={false}>
                {step.locked ? (
                  <motion.span key="lock" variants={popIn} initial="hidden" animate="show" exit="exit">
                    <Lock className="size-3.5" />
                  </motion.span>
                ) : step.done && !selected ? (
                  <motion.span key="done" variants={popIn} initial="hidden" animate="show" exit="exit">
                    <Check className="size-4" strokeWidth={3} />
                  </motion.span>
                ) : (
                  <motion.span key="number" variants={popIn} initial="hidden" animate="show" exit="exit">
                    {index + 1}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="relative z-10 min-w-0">
              <span className="block truncate text-xs font-semibold [@container(min-width:520px)]:text-sm">{step.label}</span>
              <span className="hidden truncate text-xs font-normal text-muted-foreground [@container(min-width:600px)]:block">
                {step.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
    </div>
  );
}

/** A large selectable card: picture on top, name and detail below, clear selected state. */
export function ChoiceCard({
  selected,
  onSelect,
  disabled,
  thumb,
  title,
  detail,
  badge,
  role = "radio",
}: {
  selected?: boolean;
  onSelect: () => void;
  disabled?: boolean;
  thumb: ReactNode;
  title: string;
  detail: string;
  badge?: ReactNode;
  role?: "radio" | "link";
}) {
  const isRadio = role === "radio";
  return (
    <motion.button
      type="button"
      role={isRadio ? "radio" : undefined}
      aria-checked={isRadio ? Boolean(selected) : undefined}
      disabled={disabled}
      onClick={onSelect}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-left transition-[border-color,box-shadow] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-brand shadow-raised ring-2 ring-brand/20"
          : "border-border shadow-card hover:border-brand/40 hover:shadow-raised",
      )}
    >
      <div className="relative border-b border-border/70 bg-muted/60">
        {thumb}
        <span
          className={cn(
            "absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full border transition-colors",
            selected
              ? "border-brand bg-brand text-brand-foreground shadow-brand"
              : "border-border bg-card text-transparent",
            !isRadio && "hidden",
          )}
          aria-hidden
        >
          <AnimatePresence initial={false}>
            {selected ? (
              <motion.span key="check" variants={popIn} initial="hidden" animate="show" exit="exit">
                <Check className="size-3.5" strokeWidth={3} />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge}
        </div>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </motion.button>
  );
}

/** One setting with a switch. Its extra settings fade in underneath when it is on. */
export function ToggleSection({
  icon,
  title,
  detail,
  badge,
  checked,
  onCheckedChange,
  switchLabel,
  switchTestId,
  children,
}: {
  icon?: ReactNode;
  title: string;
  detail: string;
  badge?: ReactNode;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  switchLabel: string;
  switchTestId?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border transition-colors duration-200",
        checked ? "border-brand/30 bg-brand-subtle/40" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        {icon ? (
          <span className="px-icon-chip hidden shrink-0 sm:inline-grid [&_svg]:size-5" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={switchLabel}
          data-testid={switchTestId}
        />
      </div>
      {checked && children ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
          className="flex flex-col gap-4 border-t border-brand/15 bg-card p-3 sm:p-4"
          style={{ borderBottomLeftRadius: "inherit", borderBottomRightRadius: "inherit" }}
        >
          {children}
        </motion.div>
      ) : null}
    </section>
  );
}
