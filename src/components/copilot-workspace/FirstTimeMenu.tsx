import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RotateCcw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";

const STEPS = [
  "Connect HighLevel",
  "Install your menu link",
  "Install CSS and JavaScript",
  "Personalize your Client Hub",
  "Set up support and menu removal",
];

/** Inline steps. A portaled menu was opening empty beside the chat list. */
export function FirstTimeMenu({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        className={cn(
          "flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          open && "bg-muted",
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <Rocket className="h-4 w-4 text-muted-foreground" /> First-time setup
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="px-surface mx-1 mb-2 mt-1 space-y-3 border border-border/60 p-3">
              <ol className="space-y-2">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <span className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-brand-subtle text-[11px] font-semibold text-brand">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <Button type="button" size="sm" variant="accent" className="w-full" onClick={onResume}>
                <Rocket className="h-4 w-4" /> Continue setup
              </Button>
              <Button type="button" size="sm" variant="ghost" className="w-full" onClick={onRestart}>
                <RotateCcw className="h-4 w-4" /> Start setup again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
