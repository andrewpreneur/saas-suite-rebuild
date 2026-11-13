import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/premium/21st/spotlight";

export interface NextStep {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon: ReactNode;
}

/**
 * The page's one "do this next" card: brand wash, a pointer-following glow, and
 * the single accent button of the view. Anything else worth doing sits below as
 * quiet text links.
 */
export function NextStepCard({ step, also = [] }: { step: NextStep; also?: Array<{ label: string; onClick: () => void }> }) {
  return (
    <section
      aria-labelledby="next-step-title"
      className="px-brand-wash relative h-full overflow-hidden rounded-xl p-5 shadow-card ring-1 ring-inset ring-brand/10 sm:p-6"
    >
      <Spotlight size={320} className="from-brand/20 via-brand/10 to-transparent" />
      <div className="relative flex h-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-card text-brand shadow-card [&_svg]:size-5" aria-hidden="true">
            {step.icon}
          </span>
          <div className="min-w-0">
            <p className="px-eyebrow !text-brand">Your next step</p>
            <h2 id="next-step-title" className="mt-1 text-h4 font-semibold tracking-tight text-foreground">
              {step.title}
            </h2>
            <p className="mt-1 max-w-[56ch] text-small text-muted-foreground sm:text-body">{step.description}</p>
            {also.length > 0 ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-muted-foreground">
                <span>After that:</span>
                {also.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="rounded-sm font-medium text-foreground underline-offset-4 hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.label}
                  </button>
                ))}
              </p>
            ) : null}
          </div>
        </div>
        <Button variant="accent" onClick={step.onAction} className="h-11 w-full shrink-0 sm:w-auto">
          {step.actionLabel}
          <ArrowRight className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
