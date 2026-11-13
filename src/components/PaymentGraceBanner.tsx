import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChromeStrip } from "@/components/premium/entry/chrome";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

// Same billing portal the past-due and cancel notices open.
const STRIPE_PORTAL = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";

const PaymentGraceBanner = () => {
  const { email, approval } = useUser();
  const [graceUntil, setGraceUntil] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!email || approval === "NO") {
      setGraceUntil(null);
      return;
    }
    const normalized = email.trim().toLowerCase();
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("payment_grace_until")
        .ilike("email", normalized)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data as { payment_grace_until: string | null } | null)?.payment_grace_until;
      if (raw) {
        const d = new Date(raw);
        setGraceUntil(d.getTime() > Date.now() ? d : null);
      } else {
        setGraceUntil(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, approval]);

  if (!graceUntil) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((graceUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const formatted = graceUntil.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <ChromeStrip
      tone="warning"
      title="Your last payment failed."
      actions={
        <Button size="sm" variant="outline" onClick={() => window.open(STRIPE_PORTAL, "_blank")}>
          <CreditCard aria-hidden="true" />
          Update card
        </Button>
      }
    >
      Update your card by <strong className="font-semibold">{formatted}</strong> ({daysLeft} day
      {daysLeft === 1 ? "" : "s"} left) to keep your account active.
    </ChromeStrip>
  );
};

export default PaymentGraceBanner;
