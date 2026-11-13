import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, X } from "lucide-react";
import { useCountdown } from "./useBumpOffer";

interface OfferRow {
  plan: string;
  promo_code: string;
  percent_off: number;
  expires_at: string;
}

/** Bottom-left dashboard countdown for an active 24-hour discount. */
const OfferCountdownWidget = ({ demoOffer }: { demoOffer?: OfferRow }) => {
  const [offer, setOffer] = useState<OfferRow | null>(demoOffer ?? null);
  const [dismissed, setDismissed] = useState(false);
  const { label, expired } = useCountdown(offer?.expires_at);

  useEffect(() => {
    if (demoOffer) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email?.trim().toLowerCase();
      if (!email) return;
      const { data } = await supabase
        .from("bump_offers")
        .select("plan, promo_code, percent_off, expires_at")
        .eq("email", email)
        .eq("redeemed", false)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(1);
      if (!cancelled && data && data.length > 0) setOffer(data[0] as OfferRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [demoOffer]);

  if (!offer || dismissed || expired) return null;

  const planLabel = offer.plan === "advanced" ? "Advanced" : "Basic";

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[260px] rounded-xl border-2 border-primary/40 bg-card p-4 shadow-xl">
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offer"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold text-foreground">
        {offer.percent_off}% off your first month on {planLabel}
      </p>
      <p className="mt-1 font-mono text-sm font-bold text-primary">{offer.promo_code}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> Offer only valid for 24 hours — {label} left
      </p>
      <Button
        size="sm"
        className="mt-3 w-full"
        onClick={() => {
          window.location.href = `/app/billing?promo=${encodeURIComponent(offer.promo_code)}`;
        }}
      >
        Claim it
      </Button>
    </div>
  );
};

export default OfferCountdownWidget;