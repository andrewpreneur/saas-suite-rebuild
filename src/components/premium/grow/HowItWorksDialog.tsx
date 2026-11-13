import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The long explanation a calm screen no longer shows inline. Opened from the
 * page's "..." menu as "How this works". Closes with Esc and returns focus.
 */
export function HowItWorksDialog({
  open,
  onOpenChange,
  title,
  intro,
  steps,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  intro?: string;
  steps?: { title: string; detail?: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {intro ? <DialogDescription>{intro}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {steps ? (
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold tabular-nums text-brand"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block font-medium text-foreground">{step.title}</span>
                  {step.detail ? <span className="mt-0.5 block text-muted-foreground">{step.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}
