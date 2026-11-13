import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Home, Check } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4">
      <div className="max-w-lg w-full text-center bg-card border rounded-2xl shadow-lg p-8 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold mb-3 text-foreground">
          It looks like your device is having a hard time loading this page
        </h1>
        <p className="text-muted-foreground mb-6">
          This often happens inside in-app browsers (like Gmail, Facebook, or Instagram).
          Try opening it in your normal browser for a smoother experience.
        </p>

        <div className="bg-muted/50 border rounded-lg px-3 py-2 mb-6 text-left">
          <p className="text-xs text-muted-foreground mb-1">Page you were trying to reach:</p>
          <p className="text-sm font-mono break-all text-foreground">{fullUrl}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={openExternally} className="flex items-center gap-2" size="lg">
            <ExternalLink className="h-4 w-4" />
            Open in browser
          </Button>
          <Button onClick={copyUrl} variant="outline" className="flex items-center gap-2" size="lg">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-1 mt-6 text-sm text-muted-foreground hover:text-foreground underline"
        >
          <Home className="h-3.5 w-3.5" />
          Return to home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
