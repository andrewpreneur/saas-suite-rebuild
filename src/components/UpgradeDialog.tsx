import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, Check, Gift, Sparkles } from 'lucide-react';
import { useOfferTimer } from '@/hooks/useOfferTimer';
import PricingModeToggle from '@/components/pricing/PricingModeToggle';
import AgencyPricingCards from '@/components/pricing/AgencyPricingCards';
import type { PricingMode } from '@/constants/pricingPlans';
import { isNativeApp } from '@/utils/nativeApp';
import SaasPricingCards from '@/components/pricing/SaasPricingCards';
import StripeEmbeddedCheckout from '@/components/StripeEmbeddedCheckout';
import { SAME_DAY_WL_SUPPORT, type CheckoutPlan } from '@/constants/pricingPlans';
import PlanFeatureLabel from '@/components/pricing/PlanFeatureLabel';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTrialMode?: boolean;
  isSixMonthsOffer?: boolean;
  offerExpiresAt?: Date;
}

const UpgradeDialog = ({ open, onOpenChange, isTrialMode = false, isSixMonthsOffer = false, offerExpiresAt }: UpgradeDialogProps) => {
  const [isYearly, setIsYearly] = useState(true);
  const [showTrialPopup, setShowTrialPopup] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>('saas');
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);

  // Use centralized timer hook
  const { timeLeft } = useOfferTimer(offerExpiresAt || null);

  const features = [
    "Everything in Basic",
    "3 Custom SaaS Plan Onboarding Experiences",
    "SaaS Health Dashboard",
    "Login & Onboarding Tracking",
    "Voice AI Support",
    "Human Handover & Chat Intervention",
    SAME_DAY_WL_SUPPORT,
    "Workflows & Automations",
    "AI CoPilot",
    "Custom Domain",
    "Full AI Marketing Suite",
    "Unlimited Users",
  ];


  const monthlyPrice = 97;
  const yearlyPrice = isSixMonthsOffer ? 582 : 870;
  const monthlyEquivalent = isSixMonthsOffer ? 48.5 : 72.5;

  // Uses the app's own checkout so access is granted automatically and anyone
  // who already subscribes is warned instead of being charged twice.
  const handleGetStarted = () => {
    // The 6-months-free price only exists on its dedicated payment links.
    if (isSixMonthsOffer) {
      window.location.href = isYearly
        ? 'https://link.saassuite.ai/payment-link/68ccb17d67ee3b037569329d'
        : 'https://link.saassuite.ai/payment-link/68ccb59a67ee3be0a16932bd';
      return;
    }
    setCheckoutPlan(isYearly ? 'advanced_annual' : 'advanced');
  };


  // Trial mode on the web shows one focused plan card; everything else shows the shared plan grid.
  const singlePlan = !(isNativeApp() || !isTrialMode);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto', pricingMode === 'agency' ? 'sm:max-w-4xl' : singlePlan ? 'sm:max-w-xl' : 'sm:max-w-6xl')}>
          <DialogHeader className="items-center text-center sm:text-center">
            <p className="px-eyebrow">Plans</p>
            <DialogTitle className="text-center text-h3">Upgrade Your Plan</DialogTitle>
            <DialogDescription className="text-center">
              Pick the plan that fits where your agency is today. You can change it any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <PricingModeToggle value={pricingMode} onChange={setPricingMode} />

            {pricingMode === 'agency' ? (
              <AgencyPricingCards variant="panel" />
            ) : !singlePlan ? (
              <SaasPricingCards onSelect={setCheckoutPlan} onStarter={() => onOpenChange(false)} />
            ) : (
            <>
            {/* Six Months Offer Notification */}
            {isSixMonthsOffer && (
              <div role="status" className="flex items-center justify-center gap-3 rounded-lg border border-brand/25 bg-brand-subtle px-3 py-2 text-small">
                <Gift className="size-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="font-semibold text-foreground">Unlock 6 Months Free</span>
                <span className="tabular-nums text-muted-foreground">Offer expires {timeLeft}</span>
              </div>
            )}

            {/* Pricing Card */}
            <section aria-label="Advanced Plan" className="overflow-hidden rounded-xl border border-brand/30 bg-card shadow-raised">
              <div className="px-brand-wash space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-h4 text-foreground">Advanced Plan</h3>
                    <p className="mt-1 text-small text-muted-foreground">Everything you need to grow your business</p>
                  </div>
                  <Tag tone="brand" className="shrink-0">
                    <Sparkles aria-hidden="true" />
                    Most popular
                  </Tag>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-h1 tabular-nums text-foreground">${isYearly ? yearlyPrice : monthlyPrice}</span>
                      <span className="text-small text-muted-foreground">{isYearly ? '/year' : '/month'}</span>
                    </div>
                    <p className="mt-1 text-caption font-normal text-muted-foreground">{isYearly ? 'Billed in full yearly · Auto-renews yearly' : 'Billed monthly · Auto-renews monthly'}</p>
                    {isYearly && <p className="mt-0.5 text-caption font-normal text-muted-foreground">Equivalent to ${monthlyEquivalent}/month</p>}
                  </div>

                  {/* Billing Toggle */}
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full border border-border bg-card px-3">
                    <span className={cn('text-small', !isYearly ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      Monthly
                    </span>
                    <Switch
                      checked={isYearly}
                      onCheckedChange={setIsYearly}
                      aria-label="Bill yearly"
                    />
                    <span className={cn('text-small', isYearly ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      Yearly
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                      <PlanFeatureLabel feature={feature} className="text-small" />
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={handleGetStarted}
                  variant="accent"
                  className="w-full"
                  size="lg"
                >
                  Get Started
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </section>
            </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <StripeEmbeddedCheckout
        plan={checkoutPlan || 'advanced_annual'}
        open={checkoutPlan !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) setCheckoutPlan(null); }}
      />
      
    </>
  );
};

export default UpgradeDialog;