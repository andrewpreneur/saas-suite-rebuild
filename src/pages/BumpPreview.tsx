import { useState } from "react";
import PageSEO from "@/components/PageSEO";
import PlanBumpOffer from "@/components/bump/PlanBumpOffer";
import CallBumpOffer from "@/components/bump/CallBumpOffer";
import StrategyCallUpsell from "@/components/bump/StrategyCallUpsell";
import OfferCountdownWidget from "@/components/bump/OfferCountdownWidget";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import AddonEmbeddedCheckout from "@/components/bump/AddonEmbeddedCheckout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/** Internal preview of every bump/upsell surface. Not linked publicly. */
const BumpPreview = () => {
  const [email, setEmail] = useState("");
  const [live, setLive] = useState(false);
  const [callAdded, setCallAdded] = useState(false);
  const [showWidget, setShowWidget] = useState(true);
  const [checkout, setCheckout] = useState<{
    plan: "basic" | "advanced";
    promoCode?: string;
    addonCall?: boolean;
  } | null>(null);
  const [callCheckoutOpen, setCallCheckoutOpen] = useState(false);

  const demo = !live || !email.includes("@");

  const openPlanCheckout = (
    plan: "basic" | "advanced",
    opts: { promoCode?: string; addonCall?: boolean } = {},
  ) => {
    if (demo) {
      toast({
        title: "Preview only",
        description: "Turn on \u201cGenerate real Stripe codes\u201d and enter an email to open test checkout.",
      });
      return;
    }
    setCheckout({ plan, ...opts });
  };

  return (
    <div className="min-h-screen bg-background py-10">
      <PageSEO
        path="/bump-preview"
        title="Bump & Upsell Preview | SaaSSuite"
        description="Internal preview of SaaSSuite order bumps and upsells."
        noindex
      />

      <div className="mx-auto max-w-3xl space-y-10 px-4">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Bump &amp; Upsell Preview</h1>
          <p className="text-sm text-muted-foreground">
            Everything below is the exact UI that will drop into the order flow. Nothing here is wired into
            the live checkout yet.
          </p>
        </header>

        <Card className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="preview-email">Test email (for real Stripe codes)</Label>
            <Input
              id="preview-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Generate real Stripe codes</p>
              <p className="text-xs text-muted-foreground">
                Off = sample data only. On = creates a real 24-hour, email-locked 40% off promo code.
              </p>
            </div>
            <Switch checked={live} onCheckedChange={setLive} />
          </div>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            1. After onboarding (free signup) — 40% off Basic
          </h2>
          <p className="text-sm text-muted-foreground">
            Shows right after the initial questions, before the platform loads.
          </p>
          <PlanBumpOffer
            plan="basic"
            email={email}
            demo={demo}
            testMode
            onAccept={(code) => openPlanCheckout("basic", { promoCode: code })}
            onDecline={() => toast({ title: "Would continue to the dashboard" })}
            declineLabel="No thanks, take me in"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            2. Before the $27 purchase — 40% off Advanced
          </h2>
          <PlanBumpOffer
            plan="advanced"
            email={email}
            demo={demo}
            testMode
            onAccept={(code) => openPlanCheckout("advanced", { promoCode: code })}
            onDecline={() => toast({ title: "Would continue with Basic at $27/mo" })}
            declineLabel="No thanks, stay on Basic"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            3. Before the $97 purchase — white-label call bump
          </h2>
          <CallBumpOffer onToggle={setCallAdded} />
          <p className="text-sm text-muted-foreground">
            Order total preview: <strong>${callAdded ? "127.00 first charge ($97 + $30)" : "97.00"}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openPlanCheckout("advanced", { addonCall: callAdded })}>
              Continue to Advanced checkout{callAdded ? " (+ $30 call)" : ""}
            </Button>
            <Button variant="outline" onClick={() => (demo ? toast({ title: "Preview only" }) : setCallCheckoutOpen(true))}>
              Buy the $30 call on its own
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            4. Post-purchase upsell — $150 1:1 strategy call
          </h2>
          <p className="text-sm text-muted-foreground">
            Purchasing sends them to <code>/app?confirmed=true</code> if they're signed in, otherwise <code>/signup</code> to claim the account.
          </p>
          <StrategyCallUpsell email={email} demo={demo} testMode />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Dashboard countdown widget</h2>
          <p className="text-sm text-muted-foreground">
            Sits in the bottom-left of the dashboard while an offer is still live.
          </p>
          <Button variant="outline" onClick={() => setShowWidget((v) => !v)}>
            {showWidget ? "Hide" : "Show"} widget
          </Button>
        </section>
      </div>

      {showWidget && (
        <OfferCountdownWidget
          demoOffer={{
            plan: "basic",
            promo_code: "SAVE40-K7QM2",
            percent_off: 40,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }}
        />
      )}

      {checkout && (
        <StripeEmbeddedCheckout
          plan={checkout.plan}
          open
          onOpenChange={(v) => !v && setCheckout(null)}
          email={email}
          testMode
          promoCode={checkout.promoCode}
          addonCall={checkout.addonCall}
        />
      )}

      <AddonEmbeddedCheckout
        product="white_label_call"
        open={callCheckoutOpen}
        onOpenChange={setCallCheckoutOpen}
        email={email}
        testMode
      />
    </div>
  );
};

export default BumpPreview;