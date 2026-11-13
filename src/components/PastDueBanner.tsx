import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChromeStrip } from "@/components/premium/entry/chrome";

const STRIPE_PORTAL = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";

/**
 * Large red banner for accounts whose payment failed or whose subscription was
 * canceled. These users are NOT blocked from logging in — only their customers
 * are (all but the first customer they ever added). Branding stays saved but is
 * unapplied while the account is past due.
 */
const PastDueBanner = () => {
  const { email, approval } = useUser();
  const [pastDue, setPastDue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!email || approval === "NO") {
      setPastDue(false);
      return;
    }
    const normalized = email.trim().toLowerCase();
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("billing_state")
        .ilike("email", normalized)
        .maybeSingle();
      if (cancelled) return;
      const state = (data as { billing_state?: string | null } | null)?.billing_state;
      setPastDue(state === "PAST_DUE");
    })();
    return () => {
      cancelled = true;
    };
  }, [email, approval]);

  if (!pastDue) return null;

  return (
    <ChromeStrip
      tone="error"
      title="Payment failed or subscription canceled. Your SaaS is paused."
      actions={
        <Button size="sm" onClick={() => window.open(STRIPE_PORTAL, "_blank")}>
          <CreditCard aria-hidden="true" />
          Update card
        </Button>
      }
    >
      Your customers can't log in right now (only your first customer still has access). Your branding, menu
      link removals and settings are saved and come back as soon as you update your card.
    </ChromeStrip>
  );
};

export default PastDueBanner;
