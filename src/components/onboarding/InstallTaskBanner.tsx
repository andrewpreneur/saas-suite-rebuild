import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MonitorSmartphone, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { getDeviceType } from "@/utils/device";
import { checkInstallStatus } from "@/lib/installStatus";


/**
 * Persistent "you still need to install" task.
 * Mobile users get the emailed guide instead of a wizard they can't finish on a phone.
 */
const InstallTaskBanner = () => {
  const { email } = useUser();
  const [visible, setVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const isMobile = getDeviceType() !== "desktop";

  useEffect(() => {
    if (!email) return;
    (async () => {
      const installed = await checkInstallStatus(email);
      setVisible(!installed);
      const { data } = await supabase
        .from("saas_suite_users")
        .select("install_guide_sent_at")
        .ilike("email", email)
        .maybeSingle();
      if (data?.install_guide_sent_at) {
        const since = Date.now() - new Date(data.install_guide_sent_at).getTime();
        if (since < 24 * 60 * 60 * 1000) setSent(true);
      }
    })();
  }, [email]);


  const sendGuide = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-install-guide", {
        body: { device: getDeviceType() },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setSent(true);
      toast.success("Sent — check your email on your computer.");
    } catch (e) {
      console.error("send-install-guide failed:", e);
      toast.error("Couldn't send the guide. Try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  const openInstallGuide = () => {
    window.dispatchEvent(new CustomEvent("open-installation-guide"));
    const el = document.querySelector('[data-install-guide-target="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!visible) return null;

  return (
    <Card className="border-amber-400/70 bg-amber-50/70 dark:bg-amber-950/20 p-4 animate-install-glow">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
            <MonitorSmartphone className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm md:text-base">
              One thing left: install SaaSSuite in HighLevel
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">
              {isMobile
                ? "This part needs a desktop. We'll email you the guide so it's waiting for you."
                : "Takes about 10 minutes and puts your software in front of every client."}
            </p>
          </div>
        </div>

        {isMobile ? (
          <Button onClick={sendGuide} disabled={sending || sent} className="w-full md:w-auto shrink-0">
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : sent ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            {sent ? "Guide sent" : "Email me the install guide"}
          </Button>
        ) : (
          <Button onClick={openInstallGuide} className="w-full md:w-auto shrink-0">
            Open the installation guide
          </Button>
        )}
      </div>
    </Card>
  );
};

export default InstallTaskBanner;
