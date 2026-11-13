import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AddonEmbeddedCheckout from "./AddonEmbeddedCheckout";
import andrewImage from "@/assets/andrew-strategy-call.png.asset.json";

interface StrategyCallUpsellProps {
  email?: string | null;
  testMode?: boolean;
  /** Preview mode: don't hit Stripe. */
  demo?: boolean;
  onDecline?: () => void;
  declineLabel?: string;
  /** Fired once the $150 checkout completes. */
  onPurchased?: () => void;
}

const BULLETS = [
  "How to run ads as a SaaS agency",
  "What the best offer for you is",
  "A custom checklist to get your next few clients and grow your agency in the next 30 days",
  "A free follow-up call if you don't reach your goal",
];

/** $150 one-time 1:1 recorded strategy call with Andrew George. */
const StrategyCallUpsell = ({
  email,
  testMode = false,
  demo = false,
  onDecline,
  declineLabel = "No thanks, take me to my account",
  onPurchased,
}: StrategyCallUpsellProps) => {
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const buy = async () => {
    if (demo) {
      toast({ title: "Preview only", description: "In production this opens Stripe checkout for $150." });
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <>
    <Card className="overflow-hidden border-2 border-offer/60 shadow-[0_0_45px_-8px_hsl(var(--offer)/0.55)] ring-4 ring-offer/20">
      <div className="grid gap-0 md:grid-cols-[240px_1fr]">
        <img
          src={andrewImage.url}
          alt="Andrew George, founder of SaaSSuite, who runs the 1:1 strategy call"
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="space-y-4 p-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge className="gap-1">
              <Video className="h-3 w-3" /> Recorded 1:1
            </Badge>
            <span className="text-sm text-muted-foreground">One-time · 60 minutes</span>
          </div>
          <h3 className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
            Add a 1-hour 1:1 strategy &amp; coaching session with Andrew George
          </h3>
          <ul className="mx-auto inline-flex flex-col gap-1.5 text-left">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {b}
              </li>
            ))}
          </ul>
          <div className="flex items-end justify-center gap-2">
            <span className="text-3xl font-bold text-foreground">$150</span>
            <span className="pb-1 text-sm text-muted-foreground">one-time</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              className="h-16 w-full bg-success text-lg font-bold text-success-foreground hover:bg-success/90 sm:text-xl"
              size="lg"
              onClick={buy}
              disabled={loading}
            >
              {loading ? "Starting checkout…" : "Yes, add my strategy call"}
            </Button>
            <Button variant="ghost" onClick={onDecline} className="text-muted-foreground">
              {declineLabel}
            </Button>
          </div>
        </div>
      </div>
    </Card>
    <AddonEmbeddedCheckout
      product="strategy_call"
      open={checkoutOpen}
      onOpenChange={setCheckoutOpen}
      email={email}
      testMode={testMode}
      onComplete={() => onPurchased?.()}
    />
    </>
  );
};

export default StrategyCallUpsell;