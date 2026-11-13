import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import NumberTicker from "@/components/premium/21st/number-ticker";

/**
 * One number, what it means, and one line of context. The number counts up once
 * on load. Pass `onClick` when the card opens the place to act on that number.
 */
export function KpiCard({
  label,
  value,
  suffix,
  prefix,
  hint,
  icon,
  tone = "default",
  onClick,
  actionLabel,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "danger";
  onClick?: () => void;
  actionLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="px-eyebrow">{label}</p>
        {icon ? (
          <span className="px-icon-chip !h-8 !w-8 shrink-0 [&_svg]:size-4" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={
          "mt-2 text-h2 font-semibold tabular-nums tracking-tight " +
          (tone === "danger" ? "!text-destructive" : "")
        }
      >
        {prefix}
        <NumberTicker key={value} from={0} target={value} transition={{ duration: 0.9, type: "tween", ease: [0.16, 1, 0.3, 1] }} />
        {suffix}
      </p>
      {hint ? <p className="mt-1 text-small text-muted-foreground">{hint}</p> : null}
      {onClick && actionLabel ? (
        <span className="mt-3 inline-flex items-center gap-1 text-small font-medium text-brand">
          {actionLabel}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-surface-interactive flex h-full w-full flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5"
      >
        {body}
      </button>
    );
  }
  return <div className="px-surface flex h-full flex-col p-4 sm:p-5">{body}</div>;
}
