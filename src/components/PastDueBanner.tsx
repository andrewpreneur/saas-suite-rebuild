import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
    <div className="sticky top-0 z-40 w-full border-b-2 border-destructive bg-destructive text-destructive-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
        <AlertTriangle className="h-6 w-6 shrink-0" />
        <div className="flex-1 space-y-1 text-sm">
          <p className="text-base font-bold">
            Payment failed or subscription canceled — your SaaS is paused
          </p>
          <p className="opacity-95">
            Your customers <strong>cannot log into your platform right now</strong> (only your
            very first customer still has access). All of your branding, menu link removals and
            settings are <strong>still saved</strong> — they're just not applied while your
            subscription is inactive. Update your card to restore everything instantly.
          </p>
        </div>
        <Button
          variant="secondary"
          className="shrink-0 font-semibold"
          onClick={() => window.open(STRIPE_PORTAL, "_blank")}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Update card
        </Button>
      </div>
    </div>
  );
};

export default PastDueBanner;
