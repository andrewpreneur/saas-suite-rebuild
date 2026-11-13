import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Home, Check, Compass } from "lucide-react";
import { Tag } from "@/components/ui/tag";
import { EntryShell } from "@/components/premium/entry/EntryShell";

const NotFound = () => {
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const fullUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://saassuite.ai${location.pathname}`;

  const openExternally = () => {
    // Force-break out of in-app browsers (Gmail / Facebook / Instagram / TikTok webviews)
    // by doing a top-level navigation rather than window.open.
    try {
      window.location.href = fullUrl;
    } catch {
      window.open(fullUrl, "_blank", "noopener,noreferrer");
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <EntryShell
      wide
      title="We couldn't load this page"
      description="This often happens inside in-app browsers like Gmail, Facebook or Instagram. Open the link in your normal browser, or head back home."
      mark={<Tag tone="neutral"><Compass aria-hidden="true" />Page not found</Tag>}
      footer={
        <a href="/" className="inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline">
          <Home className="size-4" aria-hidden="true" />
          Return to home
        </a>
      }
    >
      <div className="space-y-5">
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-left">
          <p className="text-caption font-normal text-muted-foreground">Page you were trying to reach</p>
          <p className="mt-0.5 break-all font-mono text-small text-foreground">{fullUrl}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={openExternally} variant="accent" className="h-11 shrink-0 sm:flex-1">
            <ExternalLink aria-hidden="true" />
            Open in browser
          </Button>
          <Button onClick={copyUrl} variant="outline" className="h-11 shrink-0 sm:flex-1" aria-live="polite">
            {copied ? <Check className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Link copied" : "Copy link"}
          </Button>
        </div>
      </div>
    </EntryShell>
  );
};

export default NotFound;
