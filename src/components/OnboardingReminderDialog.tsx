import { useEffect, useState } from "react";
import { claimPopup } from "@/lib/popupGate";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Rocket } from "lucide-react";

/**
 * Reminds users who skipped onboarding to finish it — desktop only.
 * Shown once per session.
 */
const OnboardingReminderDialog = () => {
  const { email, actualEmail } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!email) return;
      // Team admins viewing an owner's account never see owner onboarding nudges.
      if (actualEmail && actualEmail.toLowerCase() !== email.toLowerCase()) return;
      if (window.innerWidth < 768) return; // desktop only
      if (sessionStorage.getItem("onboardingReminderShown")) return;

      const { data } = await supabase
        .from("saas_suite_users")
        .select("onboarding_skipped, onboarding_reminder_dismissed, onboarding_completed")
        .ilike("email", email)
        .maybeSingle();

      // Only nudge people who actually skipped AND never finished onboarding.
      if (
        data?.onboarding_skipped &&
        !data?.onboarding_completed &&
        !data?.onboarding_reminder_dismissed &&
        claimPopup("onboarding-reminder")
      ) {
        sessionStorage.setItem("onboardingReminderShown", "1");
        setOpen(true);
      }
    };
    check();
  }, [email, actualEmail]);

  const dismissForever = async () => {
    setOpen(false);
    if (!email) return;
    await supabase
      .from("saas_suite_users")
      .update({ onboarding_reminder_dismissed: true })
      .ilike("email", email);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Finish setting up your SaaS Suite
          </DialogTitle>
          <DialogDescription>
            You skipped onboarding earlier. You're on a desktop now, so this is the perfect time to install
            SaaSSuite in HighLevel and unlock the branding tool, login tracking, support and everything else.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => navigate("/v2-onboarding")}
          >
            Complete my onboarding
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
            Remind me later
          </Button>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={dismissForever}>
            Don't show this again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingReminderDialog;
