import { useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small info icon. A mouse reveals the note on hover. A tap toggles it on
 * touch. Keyboard focus opens it, and Escape or blur closes it.
 */
export function InfoTip({
  children,
  className,
  label = "More info",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const pointer = useRef<"mouse" | "touch" | "keyboard">("keyboard");
  const lastTouch = useRef(0);

  return (
    <Tooltip open={open} onOpenChange={() => {}} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          onPointerDown={(event) => {
            pointer.current = event.pointerType === "touch" ? "touch" : event.pointerType === "pen" ? "touch" : "mouse";
            if (pointer.current === "touch") lastTouch.current = Date.now();
          }}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse" || Date.now() - lastTouch.current < 700) return;
            setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse" || Date.now() - lastTouch.current < 700) return;
            setOpen(false);
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (pointer.current === "touch") setOpen((current) => !current);
          }}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[80] max-w-xs text-left text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export default InfoTip;
