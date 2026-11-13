import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import type { CheckoutPlan } from '@/constants/pricingPlans';

interface BumpCheckoutFlowProps {
  plan: CheckoutPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string;
  testMode?: boolean;
  affiliateId?: string | null;
}

/**
 * Straight-to-checkout wrapper for paid plans. The pre-purchase bump and the
 * post-purchase strategy-call upsell were removed — the only remaining offer
 * is the 40%-off Basic bump shown after a FREE signup (PostOnboardingOffer),
 * which is rendered elsewhere.
 */
const BumpCheckoutFlow = ({
  plan,
  open,
  onOpenChange,
  email,
  testMode = false,
  affiliateId,
}: BumpCheckoutFlowProps) => {
  if (!open) return null;

  return (
    <StripeEmbeddedCheckout
      plan={plan}
      open
      onOpenChange={onOpenChange}
      email={email}
      testMode={testMode}
      affiliateId={affiliateId}
    />
  );
};

export default BumpCheckoutFlow;
