import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Clock, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useBumpOffer, useCountdown } from "./useBumpOffer";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";

interface PlanBumpOfferProps {
  /** Plan the discount applies to. */
  plan: "basic" | "advanced";
  email?: string | null;
  /** Primary action — usually "open checkout with the code applied". */
  onAccept?: (code: string) => void;
  onDecline?: () => void;
  declineLabel?: string;
  testMode?: boolean;
  /** Skip the network call and render fixed sample data (preview page). */
  demo?: boolean;
}

const COPY = {
  basic: {
    headline: "Get 40% off, on us.",
    features: ["Unlimited AI chat support for your clients", "Menu link removal", "Custom onboarding + walkthroughs"],
    cta: "Claim 40% off Basic",
  },
  advanced: {
    headline: "Want unlimited users + human chat support? Advanced is for you. Get 40% off, on us.",
    features: ["Unlimited client users", "Human chat support for your clients", SAME_DAY_WL_SUPPORT, "Everything in Basic"],
    cta: "Claim 40% off Advanced",
  },
} as const;

/** Known list prices so the discounted amount renders instantly, before Stripe responds. */
const PRICING = {
  basic: { monthly: 27, discounted: 16.20 },
  advanced: { monthly: 97, discounted: 58.20 },
} as const;

const DEMO = {
  basic: { code: "SAVE40-K7QM2", percentOff: 40, ...PRICING.basic },
  advanced: { code: "SAVE40-P4TXB", percentOff: 40, ...PRICING.advanced },
} as const;

const PlanBumpOffer = ({
  plan,
  email,
  onAccept,
  onDecline,
  declineLabel = "No thanks, continue",
  testMode = false,
  demo = false,
}: PlanBumpOfferProps) => {
  const { offer, loading, error } = useBumpOffer(email, plan, !demo, testMode);
  const demoExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const active = demo ? { ...DEMO[plan], expiresAt: demoExpiry, plan } : offer;
  const { label } = useCountdown(active?.expiresAt);
  const copy = COPY[plan];
  const price = PRICING[plan];
  const discounted = active?.discounted ?? price.discounted;
  const monthly = active?.monthly ?? price.monthly;

  const copyCode = async () => {
    if (!active?.code) return;
    await navigator.clipboard.writeText(active.code);
    toast({ title: "Code copied", description: active.code });
  };

  return (
    <Card className="relative overflow-hidden border-2 border-offer/60 p-6 text-center shadow-[0_0_45px_-8px_hsl(var(--offer)/0.55)] ring-4 ring-offer/20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-offer/15 via-transparent to-offer/10" />
      <div className="relative space-y-5">
        <div className="space-y-3">
          <h3 className="text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
            {copy.headline}
          </h3>
        </div>

        <div className="flex flex-wrap items-end justify-center gap-3">
          <span className="text-4xl font-bold text-foreground">${discounted.toFixed(2)}</span>
          <span className="pb-1 text-sm text-muted-foreground line-through">${monthly}</span>
          <span className="pb-1 text-sm text-muted-foreground">first month, then normal price</span>
        </div>

        <ul className="mx-auto inline-flex flex-col gap-1.5 text-left">
          {copy.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <PlanFeatureLabel feature={f} />
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-dashed border-offer/50 bg-background/70 p-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Generating your personal code…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your code</p>
                <p className="font-mono text-lg font-bold text-foreground">{active?.code ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  <Clock className="h-3.5 w-3.5" /> {label || "24h 00m 00s"} left
                </span>
                <Button variant="outline" size="sm" onClick={copyCode} disabled={!active?.code}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Locked to your email — nobody else can use it.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            className="h-16 w-full bg-success text-lg font-bold text-success-foreground hover:bg-success/90 sm:text-xl"
            size="lg"
            disabled={!active?.code}
            onClick={() => active?.code && onAccept?.(active.code)}
          >
            {copy.cta}
          </Button>
          <Button variant="ghost" onClick={onDecline} className="text-muted-foreground">
            {declineLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default PlanBumpOffer;