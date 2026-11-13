import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopiedIcon } from "@/components/premium/21st/animated-state-icons";
import { cn } from "@/lib/utils";

/**
 * Copy button that confirms in place: the copy glyph is swapped for the 21st
 * CopiedIcon, which draws its checkmark, then returns to rest after ~1.6s.
 * `onCopy` does the actual copying (and any toast) so existing handlers stay in charge.
 */
export function CopyButton({
  onCopy,
  label = "Copy link",
  showLabel = false,
  disabled,
  className,
}: {
  onCopy: () => void;
  label?: string;
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  // 0 = idle, 1 = icon just mounted (flips to its check), 2 = hold on the check
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const handle = () => {
    onCopy();
    timers.current.forEach((t) => window.clearTimeout(t));
    setPhase(1);
    timers.current = [
      window.setTimeout(() => setPhase(2), 90),
      window.setTimeout(() => setPhase(0), 1700),
    ];
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "default" : "icon"}
      aria-label={phase ? "Copied" : label}
      disabled={disabled}
      onClick={handle}
      className={cn("shrink-0", phase ? "border-brand/40 text-brand" : "", className)}
    >
      <span className="flex size-4 items-center justify-center" aria-hidden="true">
        {phase ? <CopiedIcon size={20} duration={phase === 1 ? 60 : 600000} /> : <Copy className="size-4" />}
      </span>
      {showLabel ? <span aria-live="polite">{phase ? "Copied" : "Copy"}</span> : null}
    </Button>
  );
}
