import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, MonitorSmartphone, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { pageEnter } from "@/lib/motion";
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
      toast.success("Guide sent. Open the email on your computer.");
    } catch (e) {
      console.error("send-install-guide failed:", e);
      toast.error("Could not send the guide. Try again in a moment.");
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
    <motion.section
      variants={pageEnter}
      initial="hidden"
      animate="show"
      aria-label="Finish installing SaaSSuite"
      className="px-surface px-brand-wash p-4 sm:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="px-icon-chip shrink-0 bg-card" aria-hidden="true">
            <MonitorSmartphone className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="px-eyebrow">One thing left</p>
            <p className="text-body font-semibold text-foreground">
              Install SaaSSuite in HighLevel
            </p>
            <p className="mt-0.5 text-small text-muted-foreground">
              {isMobile
                ? "This part needs a computer. We can email you the guide so it is waiting for you."
                : "It takes about 10 minutes and puts your software in front of every client."}
            </p>
          </div>
        </div>

        {isMobile ? (
          <Button
            variant="accent"
            onClick={sendGuide}
            disabled={sending || sent}
            className="w-full shrink-0 md:w-auto"
          >
            {sending ? <Loader2 className="animate-spin" /> : sent ? <Check /> : <Mail />}
            {sent ? "Guide sent" : "Email me the install guide"}
          </Button>
        ) : (
          <Button variant="accent" onClick={openInstallGuide} className="w-full shrink-0 md:w-auto">
            Open the install guide
            <ArrowRight />
          </Button>
        )}
      </div>
    </motion.section>
  );
};

export default InstallTaskBanner;
