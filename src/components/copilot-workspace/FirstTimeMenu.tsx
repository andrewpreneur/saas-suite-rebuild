import { useState } from "react";
import { ChevronDown, RotateCcw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        className="w-full justify-start gap-2 px-3 text-sm font-normal"
        onClick={() => setOpen((value) => !value)}
      >
        <Rocket className="h-4 w-4" /> First-time setup
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="mx-2 mb-1 space-y-2 rounded-md border border-border bg-background p-2">
          <ol className="space-y-1 px-1 text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <li key={step}>{index + 1}. {step}</li>
            ))}
          </ol>
          <Button type="button" size="sm" variant="secondary" className="w-full justify-start" onClick={onResume}>
            <Rocket className="h-4 w-4" /> Continue setup
          </Button>
          <Button type="button" size="sm" variant="ghost" className="w-full justify-start" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" /> Re-Onboard
          </Button>
        </div>
      )}
    </div>
  );
}
