import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { CopyField, SuccessMark } from "@/components/premium/onboarding/pieces";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";
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
      if (data?.agency_id)
        setResolvedUrl(`https://yoursoftwareonboarding.com/v2/${data.agency_id}`);
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
    // One restrained burst rather than three: celebratory, not noisy.
    const timers = [
      setTimeout(
        () =>
          confetti({
            particleCount: 70,
            spread: 80,
            startVelocity: 38,
            origin,
            scalar: 0.9,
            ticks: 140,
          }),
        450,
      ),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    if (!finalUrl) return false;
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Long-press the link instead.");
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-center">
        <div className="flex min-w-0 flex-col items-center gap-6 py-2">
          {open ? <SuccessMark size={48} /> : null}

          <div className="space-y-2">
            <DialogTitle className="text-h3 text-foreground">
              Your client portal is live
            </DialogTitle>
            <DialogDescription className="text-body text-muted-foreground">
              We built it from your answers. You will add it to HighLevel as a menu link later.
            </DialogDescription>
          </div>

          <div className="w-full min-w-0 text-left">
            {finalUrl ? (
              <CopyField value={finalUrl} label="Copy your portal link" onCopy={copy} />
            ) : (
              <div className="rounded-md border border-border bg-muted p-3 text-center">
                <TextShimmer className="text-small">Preparing your link</TextShimmer>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2">
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={!finalUrl}
              onClick={() => {
                trackEvent("hub_live_opened", "Opened generated portal");
                if (finalUrl) window.open(finalUrl, "_blank", "noopener");
              }}
            >
              <ExternalLink />
              Open my portal
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                trackEvent("hub_live_modal_closed", "Closed portal celebration");
                onOpenChange(false);
              }}
            >
              I will open it later
            </Button>
          </div>

          <p className="text-caption text-muted-foreground">
            No login needed for the next 24 hours, so you can preview it like a client would.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HubLiveModal;
