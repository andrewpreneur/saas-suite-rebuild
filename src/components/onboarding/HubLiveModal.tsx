import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, PartyPopper, Check } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import { supabase } from "@/integrations/supabase/client";
import { useHubUrls } from "@/lib/hubUrl";

interface HubLiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hubUrl: string | null;
}

/**
 * Shown once, right after intro questions: celebrates the portal we just
 * generated and hands them their live hub URL before we ask them to install.
 */
const HubLiveModal = ({ open, onOpenChange, hubUrl }: HubLiveModalProps) => {
  const { email } = useUser();
  const { trackEvent } = useSessionTracker();
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(hubUrl);

  useEffect(() => {
    setResolvedUrl(hubUrl);
  }, [hubUrl]);

  // Fall back to the stored agency id if the caller didn't pass a URL through.
  useEffect(() => {
    if (resolvedUrl || !open || !email) return;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("agency_id")
        .ilike("email", email)
        .maybeSingle();
      if (data?.agency_id) setResolvedUrl(`https://yoursoftwareonboarding.com/v2/${data.agency_id}`);
    })();
  }, [open, email, resolvedUrl]);
  const hubId = resolvedUrl ? resolvedUrl.split("/").filter(Boolean).pop() || null : null;
  const hubUrlFor = useHubUrls([hubId]);
  const finalUrl = hubId ? hubUrlFor(hubId) : null;

  // Confetti burst on the portal URL — the gamified "you built something" moment.
  useEffect(() => {
    if (!open) return;
    trackEvent("hub_live_modal_shown", "Portal generated celebration");
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const origin = { x: 0.5, y: 0.42 };
    const timers = [
      setTimeout(() => confetti({ particleCount: 130, spread: 90, startVelocity: 45, origin, scalar: 1.05 }), 250),
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin, scalar: 0.9 }), 550),
      setTimeout(() => confetti({ particleCount: 60, spread: 160, origin, scalar: 0.8 }), 850),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    if (!finalUrl) return;
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the link instead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-center">
        <div className="space-y-5 py-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <PartyPopper className="w-6 h-6 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              Congrats! We generated your custom SaaS onboarding portal.
            </h2>
            <p className="text-sm text-muted-foreground">
              You'll install this as a custom menu link in GHL later.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 break-all text-sm font-mono">
            {finalUrl || "Preparing your link..."}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={!finalUrl}
              onClick={() => {
                trackEvent("hub_live_opened", "Opened generated portal");
                if (finalUrl) window.open(finalUrl, "_blank", "noopener");
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open it now
            </Button>
            <Button variant="outline" className="w-full" disabled={!finalUrl} onClick={copy}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                trackEvent("hub_live_modal_closed", "Closed portal celebration");
                onOpenChange(false);
              }}
            >
              I'll open it later
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            No login needed for the next 24 hours so you can preview it like a client would.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HubLiveModal;
