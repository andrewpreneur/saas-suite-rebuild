import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Check } from 'lucide-react';
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


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={pricingMode === 'agency' ? 'max-w-4xl' : 'max-w-6xl max-h-[90vh] overflow-y-auto'}>
          <DialogHeader>
            <DialogTitle className="text-center">Upgrade Your Plan</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <PricingModeToggle value={pricingMode} onChange={setPricingMode} />

            {pricingMode === 'agency' ? (
              <AgencyPricingCards variant="panel" />
            ) : isNativeApp() || !isTrialMode ? (
              <SaasPricingCards onSelect={setCheckoutPlan} onStarter={() => onOpenChange(false)} />
            ) : (
            <>
            {/* Six Months Offer Notification */}
            {isSixMonthsOffer && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <div className="text-sm font-medium text-primary mb-1">
                  🎉 Unlock 6 Months Free
                </div>
                <div className="text-xs text-muted-foreground">
                  Offer expires {timeLeft}
                </div>
              </div>
            )}

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3">
              <span className={`text-sm ${!isYearly ? 'font-medium' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <span className={`text-sm ${isYearly ? 'font-medium' : 'text-muted-foreground'}`}>
                Yearly
              </span>
            </div>

            {/* Pricing Card */}
            <Card className="border-2 border-primary">
              <CardHeader className="text-center">
              <CardTitle>Advanced Plan</CardTitle>
                <CardDescription>
                  Everything you need to grow your business
                </CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold">
                    ${isYearly ? yearlyPrice : monthlyPrice}
                    <span className="text-base font-normal text-muted-foreground">
                      {isYearly ? '/year' : '/month'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{isYearly ? 'Billed in full yearly · Auto-renews yearly' : 'Billed monthly · Auto-renews monthly'}</p>
                  {isYearly && <p className="mt-1 text-xs text-muted-foreground">Equivalent to ${monthlyEquivalent}/month</p>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <PlanFeatureLabel feature={feature} className="text-sm" />
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={handleGetStarted}
                  className="w-full mt-6"
                  size="lg"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
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