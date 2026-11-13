import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { SuccessIcon } from "@/components/premium/21st/animated-state-icons";
import { EASE_OUT, SPRING_SNAPPY, SPRING_SOFT, popIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** A selectable card. Use a group of these instead of a dropdown when there are few choices. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  role = "radio",
  className,
  ...rest
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  role?: "radio" | "checkbox";
  className?: string;
  id?: string;
}) {
  return (
    <motion.button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_SNAPPY}
      className={cn(
        "group relative flex min-h-[3.5rem] w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left shadow-card",
        "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-brand bg-brand-subtle ring-1 ring-brand"
          : "border-border hover:border-brand/40 hover:shadow-raised",
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium text-foreground">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-small text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-150",
          selected ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card",
        )}
      >
        <AnimatePresence initial={false}>
          {selected ? (
            <motion.span key="check" variants={popIn} initial="hidden" animate="show" exit="exit">
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/** Circular progress with a label in the middle. */
export function ProgressRing({
  value,
  total,
  size = 56,
  stroke = 5,
  className,
  children,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const complete = pct >= 1;
  return (
    <span
      role="img"
      aria-label={`${value} of ${total} done`}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          className={complete ? "stroke-success" : "stroke-brand"}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={SPRING_SOFT}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-caption font-semibold tabular-nums text-foreground">
        {children ?? `${value}/${total}`}
      </span>
    </span>
  );
}

/** Round checkbox whose tick draws itself in. */
export function CheckDot({
  checked,
  size = 24,
  className,
}: {
  checked: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <motion.span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 transition-colors duration-150",
        checked ? "border-success bg-success text-success-foreground" : "border-border bg-card",
        className,
      )}
      style={{ width: size, height: size }}
      initial={false}
      animate={{ scale: checked ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.62, height: size * 0.62 }}>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
        />
      </svg>
    </motion.span>
  );
}

/** A value to paste somewhere else, with a copy button that confirms. */
export function CopyField({
  value,
  onCopy,
  label,
  mono = true,
  wrap = false,
  className,
}: {
  value: string;
  /** Do the copy (and any tracking or toast). Return false if it failed. */
  onCopy: () => void | boolean | Promise<void | boolean>;
  label: string;
  mono?: boolean;
  wrap?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border border-border bg-muted py-1.5 pl-3 pr-1.5",
        wrap
          ? "flex-col items-stretch pb-2 pr-3 pt-3 sm:flex-row sm:items-center sm:py-1.5 sm:pr-1.5"
          : "items-center",
        className,
      )}
    >
      <code
        className={cn(
          "min-w-0 flex-1 text-small text-foreground",
          mono && "font-mono",
          wrap ? "break-all" : "truncate",
        )}
      >
        {value}
      </code>
      <button
        type="button"
        aria-label={copied ? "Copied" : label}
        onClick={async () => {
          const ok = await onCopy();
          if (ok !== false) setCopied(true);
        }}
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-small font-semibold sm:h-9",
          "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          copied
            ? "bg-success text-success-foreground"
            : "bg-card text-foreground shadow-card hover:bg-brand-subtle",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "done" : "copy"}
            variants={popIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

/**
 * One-shot success mark for finish states. Plays SuccessIcon's spinner-to-tick
 * once, then holds the finished tick (SuccessIcon alone keeps looping).
 */
export function SuccessMark({ size = 72, className }: { size?: number; className?: string }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 1340);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <motion.span
      variants={popIn}
      initial="hidden"
      animate="show"
      className={cn(
        "px-brand-wash inline-grid place-items-center rounded-full text-brand",
        className,
      )}
      style={{ width: size + 40, height: size + 40 }}
    >
      {settled ? (
        <svg
          viewBox="0 0 40 40"
          fill="none"
          style={{ width: size, height: size }}
          aria-hidden="true"
        >
          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth={2} />
          <path
            d="M12 20l6 6 10-12"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <SuccessIcon size={size} duration={700} />
      )}
    </motion.span>
  );
}

/** A quiet settings row: label and help on the left, a control on the right. */
export function SettingRow({
  title,
  description,
  control,
  htmlFor,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-body font-medium text-foreground">
          {title}
        </label>
        {description ? (
          <p className="mt-0.5 text-small text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
