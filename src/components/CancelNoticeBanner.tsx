import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChromeStrip } from "@/components/premium/entry/chrome";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { shouldShowCancellationNotice } from "@/lib/trialNotice";

const STRIPE_PORTAL = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";

/** Yellow notice for canceled accounts that keep full access until their paid period ends. */
const CancelNoticeBanner = () => {
  const { email, approval } = useUser();
  const [until, setUntil] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!email || approval === "NO") {
      setUntil(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("cancel_access_until, trial_source")
        .ilike("email", email.trim().toLowerCase())
        .maybeSingle();
      if (cancelled) return;
      const row = data as { cancel_access_until?: string | null; trial_source?: string | null } | null;
      if (!shouldShowCancellationNotice(row?.trial_source)) {
        setUntil(null);
        return;
      }
      const raw = row?.cancel_access_until;
      const d = raw ? new Date(raw) : null;
      setUntil(d && d.getTime() > Date.now() ? d : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [email, approval]);

  if (!until) return null;

  const daysLeft = Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86400000));
  const formatted = until.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <ChromeStrip
      tone="warning"
      icon={Clock}
      title="Your subscription was canceled."
      actions={
        <Button size="sm" variant="outline" onClick={() => (window.location.href = STRIPE_PORTAL)}>
          Keep my plan
        </Button>
      }
    >
      You keep full access until <strong className="font-semibold">{formatted}</strong> ({daysLeft} day
      {daysLeft === 1 ? "" : "s"} left), then your account moves to Starter.
    </ChromeStrip>
  );
};

export default CancelNoticeBanner;
