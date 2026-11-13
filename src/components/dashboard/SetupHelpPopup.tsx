import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { claimPopup } from "@/lib/popupGate";
import { useTipsBot } from "@/components/tips-bot";
import { shouldAutoStart } from "@/lib/tourSchedule";
import { SUPPORT_SMS_NUMBER, supportSmsUrl } from "@/lib/supportContact";

const STORAGE_KEY = "setup_help_popup_seen";
const SMS_MESSAGE = "I just got SaaSSuite- can you help me get it all setup?";

// One-time popup on first dashboard visit inviting the user to text us
// for hands-on installation help. Opens the native SMS app via sms: link.
export default function SetupHelpPopup() {
  const [open, setOpen] = useState(false);
  const { actualEmail, effectiveEmail } = useUser();
  // Team admins (and impersonation) viewing someone else's account skip this.
  const isTeamView =
    !!actualEmail && !!effectiveEmail && actualEmail.toLowerCase() !== effectiveEmail.toLowerCase();

  const { isWalkthroughMode } = useTipsBot();
  useEffect(() => {
    if (!actualEmail || isTeamView) return;
    // Never stack on top of the walkthrough; it waits for a later visit.
    if (isWalkthroughMode || shouldAutoStart("nav", actualEmail)) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      const timer = window.setTimeout(() => {
        if (!claimPopup("setup-help")) return;
        localStorage.setItem(STORAGE_KEY, "1");
        setOpen(true);
      }, 1200);
      return () => window.clearTimeout(timer);
    } catch {
      // localStorage unavailable — don't nag every load
    }
  }, [actualEmail, isTeamView, isWalkthroughMode]);

  return <TextUsDialog open={open} onOpenChange={setOpen} />;
}

/** The "text us" support modal — opens the phone's messaging app with a ready message. */
export function TextUsDialog({ open, onOpenChange, message = SMS_MESSAGE, title = "Let us help you get setup!", description = "Text us and we'll guide you through installation & answer any questions immediately.", phone }: { open: boolean; onOpenChange: (o: boolean) => void; message?: string; title?: string; description?: string; phone?: string }) {
  const setOpen = onOpenChange;
  const smsNumber = (phone || SUPPORT_SMS_NUMBER).replace(/\D/g, "") || SUPPORT_SMS_NUMBER;
  const smsUrl = supportSmsUrl(message, smsNumber);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-7 w-7 text-primary" />
        </div>
        <DialogTitle className="text-xl font-bold text-foreground">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <a href={smsUrl} aria-label="Text us">
              <MessageCircle className="mr-2 h-4 w-4" />
              Text Us Now
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="https://saassuite.ai/book">Book a time at saassuite.ai/book</a>
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
