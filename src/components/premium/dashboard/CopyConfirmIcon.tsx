import { useEffect, useRef, useState } from "react";
import { CopiedIcon } from "@/components/premium/21st/animated-state-icons";

const HOLD = 1_000_000_000; // long enough that the icon never flips on its own

/**
 * Clipboard icon that morphs into a drawn check when `copied` turns true, then
 * settles back. Wraps the 21st.dev CopiedIcon (which normally loops on a timer)
 * so it only plays in answer to a real copy.
 */
export function CopyConfirmIcon({ copied, size = 18, className }: { copied: boolean; size?: number; className?: string }) {
  const [run, setRun] = useState(0);
  const [duration, setDuration] = useState(HOLD);
  const wasCopied = useRef(false);

  useEffect(() => {
    if (copied && !wasCopied.current) {
      setDuration(60); // flip to the check almost at once
      const hold = window.setTimeout(() => setDuration(HOLD), 100); // then hold it
      wasCopied.current = true;
      return () => window.clearTimeout(hold);
    }
    if (!copied && wasCopied.current) {
      wasCopied.current = false;
      setDuration(HOLD);
      setRun((n) => n + 1); // remount: back to the resting clipboard
    }
  }, [copied]);

  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      <CopiedIcon key={run} size={size} duration={duration} className={className} />
    </span>
  );
}

/** Copy state that clears itself, shared by every copy button in this area. */
export function useCopied(resetMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const markCopied = (key = "default") => {
    setCopiedKey(key);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiedKey(null), resetMs);
  };
  return { copiedKey, markCopied };
}
