import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** A browser window: three dots, an address pill, then the page. */
export function BrowserFrame({
  address,
  children,
  className,
}: {
  address: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-raised",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/70 px-3 py-2">
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-card">
          <Lock className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{address}</span>
        </div>
        <span className="w-10 shrink-0" aria-hidden />
      </div>
      {children}
    </div>
  );
}

/** A phone: dark bezel, speaker notch, home bar. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative w-[248px] max-w-full rounded-[2.25rem] bg-foreground p-2 shadow-dialog",
        className,
      )}
    >
      <span
        className="absolute left-1/2 top-3.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-foreground"
        aria-hidden
      />
      <div className="overflow-hidden rounded-[1.75rem] bg-card">{children}</div>
      <span
        className="absolute bottom-3.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-foreground/25"
        aria-hidden
      />
    </div>
  );
}
