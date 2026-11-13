import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useTipsBot } from "@/components/tips-bot";
import { shouldAutoStart } from "@/lib/tourSchedule";
import { SUPPORT_SMS_NUMBER, supportSmsUrl } from "@/lib/supportContact";

const STORAGE_KEY = "setup_help_popup_seen";
const SMS_MESSAGE = "I just got SaaSSuite- can you help me get it all setup?";

// Quiet inline card on the dashboard inviting the user to text us for hands-on
// installation help. It used to be a popup on the first visit; now it waits in the
// page until it is dismissed, and never covers the screen.
export default function SetupHelpPopup({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  const { actualEmail, effectiveEmail } = useUser();
  // Team admins (and impersonation) viewing someone else's account skip this.
  const isTeamView =
    !!actualEmail && !!effectiveEmail && actualEmail.toLowerCase() !== effectiveEmail.toLowerCase();

  const { isWalkthroughMode } = useTipsBot();
  useEffect(() => {
    if (!actualEmail || isTeamView) return;
    // Stay out of the way while the walkthrough runs; it shows on a later visit.
    if (isWalkthroughMode || shouldAutoStart("nav", actualEmail)) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      setShow(true);
    } catch {
      // localStorage unavailable: don't nag every load
    }
  }, [actualEmail, isTeamView, isWalkthroughMode]);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const smsUrl = supportSmsUrl(SMS_MESSAGE, SUPPORT_SMS_NUMBER);

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.aside
          key="setup-help"
          aria-label="Setup help"
          data-testid="setup-help-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
          className={cn("overflow-hidden", className)}
        >
          <div className="px-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
                <MessageCircle />
              </span>
              <div className="min-w-0">
                <p className="text-small font-semibold text-foreground">Want a hand getting set up?</p>
                <p className="text-small text-muted-foreground">
                  Text us and we'll guide you through installation and answer your questions.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                aria-label="Dismiss setup help"
                className="-mr-1 -mt-1 size-11 shrink-0 text-muted-foreground sm:hidden"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button asChild size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none">
                <a href={smsUrl} aria-label="Text us">
                  <MessageCircle className="mr-2 size-4" aria-hidden="true" />
                  Text us
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none">
                <a href="https://saassuite.ai/book">Book a time</a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                aria-label="Dismiss setup help"
                className="hidden size-9 text-muted-foreground sm:inline-flex"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

/** The "text us" support modal — opens the phone's messaging app with a ready message. */
export function TextUsDialog({ open, onOpenChange, message = SMS_MESSAGE, title = "Let us help you get setup!", description = "Text us and we'll guide you through installation & answer any questions immediately.", phone }: { open: boolean; onOpenChange: (o: boolean) => void; message?: string; title?: string; description?: string; phone?: string }) {
  const setOpen = onOpenChange;
  const smsNumber = (phone || SUPPORT_SMS_NUMBER).replace(/\D/g, "") || SUPPORT_SMS_NUMBER;
  const smsUrl = supportSmsUrl(message, smsNumber);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <span className="px-icon-chip mx-auto mb-3 [&_svg]:size-5" aria-hidden="true">
          <MessageCircle />
        </span>
        <DialogTitle className="text-h4 text-foreground">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild variant="accent" size="lg" className="w-full">
            <a href={smsUrl} aria-label="Text us">
              <MessageCircle className="mr-2 h-4 w-4" />
              Text us now
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
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
