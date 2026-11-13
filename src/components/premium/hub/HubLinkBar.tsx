import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

/**
 * The one bar every Client Hub page starts with: which plan you are editing,
 * the public link your clients open, copy, and (optionally) open.
 */
export function HubLinkBar({
  label,
  planSelect,
  url,
  pendingText = "Setting up your link…",
  onCopy,
  onOpen,
  extra,
  className,
  ...rest
}: Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  label: string;
  planSelect?: ReactNode;
  url?: string | null;
  pendingText?: ReactNode;
  onCopy: () => void;
  onOpen?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div
      {...rest}
      className={cn("px-surface flex min-w-0 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center", className)}
    >
      {planSelect ? <div className="shrink-0">{planSelect}</div> : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-muted/50 px-3">
          <span className="px-eyebrow hidden shrink-0 sm:inline">{label}</span>
          {url ? (
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground sm:text-sm" title={url}>
              {url}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{pendingText}</span>
          )}
        </div>
        <CopyButton onCopy={onCopy} disabled={!url} label={`Copy ${label.toLowerCase()}`} className="size-11" />
        {onOpen ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Open in a new tab"
            disabled={!url}
            onClick={onOpen}
          >
            <ExternalLink className="size-4" />
          </Button>
        ) : null}
      </div>
      {extra ? <div className="flex shrink-0 flex-wrap items-center gap-2">{extra}</div> : null}
    </div>
  );
}
