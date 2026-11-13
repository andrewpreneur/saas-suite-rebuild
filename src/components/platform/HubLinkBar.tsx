import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** One copy + preview control, used wherever a page shows a shareable link. */
export function HubLinkBar({
  label,
  url,
  previewLabel = "Preview",
}: {
  label: string;
  url: string;
  previewLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  };
  return (
    <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        readOnly
        value={url}
        className="min-w-0 w-full font-mono text-xs xl:flex-1"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            {previewLabel}
          </a>
        </Button>
      </div>
    </div>
  );
}
