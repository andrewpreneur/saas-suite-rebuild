import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BadgePercent, Clock, X } from "lucide-react";
import { ChromeDock, dockCardClass } from "@/components/premium/entry/chrome";
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

  const claim = () => {
    window.location.href = `/app/billing?promo=${encodeURIComponent(offer.promo_code)}`;
  };

  return (
    <ChromeDock>
      <aside aria-label="Limited-time offer" className={dockCardClass}>
        <div className="flex items-center gap-3 md:items-start">
          <span className="px-icon-chip hidden shrink-0 md:inline-grid">
            <BadgePercent className="size-5" aria-hidden="true" />
          </span>
          <BadgePercent className="size-4 shrink-0 text-brand md:hidden" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-small font-semibold text-foreground">
              {offer.percent_off}% off your first month on {planLabel}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-caption font-normal tabular-nums text-muted-foreground md:hidden">
              <Clock className="size-3" aria-hidden="true" /> {label} left
            </p>
            <p className="mt-0.5 hidden text-caption font-normal text-muted-foreground md:block">
              Offer only valid for 24 hours
            </p>
          </div>
          <Button size="sm" variant="accent" className="shrink-0 md:hidden" onClick={claim}>
            Claim it
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss offer"
            className="-mr-1 shrink-0 text-muted-foreground md:-mr-2 md:-mt-2"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-3 hidden items-center justify-between gap-2 rounded-md border border-dashed border-brand/30 bg-brand-subtle px-3 py-2 md:flex">
          <span className="font-mono text-small font-semibold text-brand">{offer.promo_code}</span>
          <span className="whitespace-nowrap text-caption tabular-nums text-foreground">{label} left</span>
        </div>
        <Button size="sm" variant="accent" className="mt-3 hidden w-full md:inline-flex" onClick={claim}>
          Claim it
        </Button>
      </aside>
    </ChromeDock>
  );
};

export default OfferCountdownWidget;
