import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The offer at the top of a paid service page: what you get, the price, and the
 * page's one accent action. Uses the page's single brand wash.
 */
export function OfferCard({
  eyebrow,
  title,
  description,
  features,
  price,
  priceUnit,
  priceNote,
  action,
  footnote,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  features: string[];
  price: ReactNode;
  priceUnit?: string;
  priceNote?: ReactNode;
  action: ReactNode;
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "px-surface grid overflow-hidden p-0 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]",
        className,
      )}
    >
      <div className="p-4 sm:p-6">
        {eyebrow ? <p className="px-eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-h4 font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">{description}</p>
        ) : null}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand"
                aria-hidden="true"
              >
                <Check className="size-3.5" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="px-brand-wash flex flex-col justify-center gap-3 border-t border-border p-4 sm:p-6 md:border-l md:border-t-0">
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="text-h2 font-semibold tabular-nums tracking-tight text-foreground">
              {price}
            </span>
            {priceUnit ? <span className="text-sm text-muted-foreground">{priceUnit}</span> : null}
          </p>
          {priceNote ? <p className="mt-1 text-sm text-muted-foreground">{priceNote}</p> : null}
        </div>
        <div className="flex flex-col gap-2 [&>*]:w-full">{action}</div>
        {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
    </section>
  );
}
