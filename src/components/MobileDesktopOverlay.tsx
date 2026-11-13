import { useState } from "react";
import { Monitor, X } from "lucide-react";

interface MobileDesktopOverlayProps {
  children: React.ReactNode;
  title: string;
}

/**
 * Non-blocking mobile hint. The app is mobile-friendly now, so this is a
 * dismissible inline notice instead of a full-screen blocker — the tool
 * stays fully usable underneath.
 */
export function MobileDesktopOverlay({ children, title }: MobileDesktopOverlayProps) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div>
      {!dismissed && (
        <div className="md:hidden mb-3 flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            {title} is easiest on desktop, where you can work side by side with HighLevel.
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss desktop tip"
            className="-m-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}