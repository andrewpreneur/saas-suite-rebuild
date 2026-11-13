import type { ReactNode } from "react";
import { ChevronDown, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

/**
 * The calm replacement for HubLinkBar: one chip that says which plan you are
 * editing and (shortened) the link clients open. The plan picker, the full
 * link, Copy and Open live in the popover it opens.
 */
export function HubPlanChip({
  planLabel,
  planSelect,
  label,
  url,
  pendingText = "Setting up your link",
  onCopy,
  onOpen,
  extra,
  className,
  testId,
}: {
  /** e.g. "Plan 1". Omit when the page has no plans. */
  planLabel?: string;
  /** The existing plan <Select>, rendered inside the popover. */
  planSelect?: ReactNode;
  /** What the link is, e.g. "Hub link". */
  label?: string;
  url?: string | null;
  pendingText?: string;
  onCopy?: () => void;
  onOpen?: () => void;
  /** Anything else that used to sit in the bar. */
  extra?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const short = url ? url.replace(/^https?:\/\//, "") : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          aria-label={[planLabel, label, short].filter(Boolean).join(", ") + ". Change plan or copy link"}
          className={cn(
            "px-surface inline-flex min-h-11 max-w-full items-center gap-2 rounded-full px-4 text-sm transition-colors duration-150",
            "hover:bg-[hsl(var(--brand-subtle))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {planLabel ? <span className="shrink-0 font-semibold text-foreground">{planLabel}</span> : null}
          {planLabel && label ? <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" /> : null}
          {label ? (
            <>
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 truncate text-muted-foreground">{short ?? pendingText}</span>
            </>
          ) : null}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,380px)] space-y-4">
        {planSelect ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Plan you are editing</p>
            {planSelect}
          </div>
        ) : null}
        {label ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <div className="flex min-h-11 items-center rounded-md border border-border bg-muted/50 px-3">
              {url ? (
                <span className="min-w-0 flex-1 break-all py-2 font-mono text-xs text-foreground">{url}</span>
              ) : (
                <span className="text-sm text-muted-foreground">{pendingText}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {onCopy ? <CopyButton onCopy={onCopy} disabled={!url} label={`Copy ${label.toLowerCase()}`} showLabel /> : null}
              {onOpen ? (
                <Button type="button" variant="outline" disabled={!url} onClick={onOpen}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Open link
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {extra}
      </PopoverContent>
    </Popover>
  );
}
