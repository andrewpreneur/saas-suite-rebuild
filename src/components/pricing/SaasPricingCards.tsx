import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Crown, Plus } from 'lucide-react';
import BillingCycleToggle from './BillingCycleToggle';
import { SAAS_PLANS, checkoutPlanFor, type BillingCycle, type CheckoutPlan, type SaasPlanKey } from '@/constants/pricingPlans';
import PlanFeatureLabel from '@/components/pricing/PlanFeatureLabel';
import { findStorePlan, storeProductIdForCheckout } from '@/config/storeProducts';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/utils/nativeApp';
import { useStoreSubscription } from '@/hooks/useStoreSubscription';
import { RefreshCw } from 'lucide-react';

interface SaasPricingCardsProps {
  onSelect: (plan: CheckoutPlan) => void;
  onStarter?: () => void;
  currentPlan?: string | null;
  compact?: boolean;
  className?: string;
}

const money = (amount: number) => Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);

const SaasPricingCards = ({ onSelect, onStarter, currentPlan, compact, className }: SaasPricingCardsProps) => {
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const [premium, setPremium] = useState(false);
  const cycleTouched = useRef(false);
  const premiumTouched = useRef(false);
  const { restore, purchasing, activeProductIds, options, loading: storeLoading } = useStoreSubscription();
  const shownKeys: SaasPlanKey[] = ['starter', 'basic', premium ? 'premium' : 'advanced'];
  const ownsStoreProduct = activeProductIds.length > 0;

  // Open on the plan they actually bought, so monthly isn't hidden behind the yearly prices.
  useEffect(() => {
    const owned = activeProductIds
      .map((id) => findStorePlan(id))
      .filter((plan): plan is NonNullable<ReturnType<typeof findStorePlan>> => Boolean(plan && plan.entitlement !== 'agency_seat'));
    if (owned.length === 0) return;
    if (!premiumTouched.current && owned.some((plan) => plan.entitlement === 'premium_support')) setPremium(true);
    if (cycleTouched.current) return;
    const months = owned.some((plan) => plan.interval === 'month');
    const years = owned.some((plan) => plan.interval === 'year');
    if (months && !years) setCycle('monthly');
    else if (years && !months) setCycle('annual');
  }, [activeProductIds]);

  return (
    <div className={className}>
      <BillingCycleToggle value={cycle} onChange={(next) => { cycleTouched.current = true; setCycle(next); }} className="mb-8" />
      <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-3', compact && 'gap-4')}>
        {shownKeys.map((key) => {
          const plan = SAAS_PLANS[key];
          const storeProductId = key === 'starter' ? null : storeProductIdForCheckout(checkoutPlanFor(key, cycle));
          const ownsThisStorePlan = Boolean(storeProductId && activeProductIds.includes(storeProductId));
          // In the app, "Current plan" follows the exact store product owned, so
          // monthly and yearly are never both marked.
          const current = isNativeApp() || ownsStoreProduct
            ? ownsThisStorePlan
            : currentPlan === key.toUpperCase() || (key === 'premium' && currentPlan === 'PREMIUM');
          const paid = key !== 'starter';
          const storeOption = options.find((option) => option.productId === storeProductId);
          const native = isNativeApp();
          const display = cycle === 'annual' ? plan.annualTotal : plan.monthlyPrice;
          const billedPrice = native
            ? storeOption?.available ? storeOption.displayPrice : null
            : display !== null ? `$${display.toLocaleString('en-US')}` : null;
          return (
            <Card
              key={key}
              className={cn(
                'relative flex h-full flex-col overflow-visible border-2 transition-[background-color,color,border-color,box-shadow,transform] duration-500',
                key === 'advanced' && 'border-pricing shadow-lg shadow-pricing/10',
                key === 'premium' && 'border-pricing-premium bg-pricing-premium text-pricing-premium-foreground shadow-xl'
              )}
              style={(key === 'advanced' || key === 'premium') ? { animation: 'pricingTierSwap 0.42s cubic-bezier(0.22, 1, 0.36, 1) both' } : undefined}
            >
              {plan.recommended && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pricing text-pricing-foreground shadow-md hover:bg-pricing">BEST SELLER</Badge>}
              {current && <Badge variant="secondary" className="absolute right-3 top-3">Current plan</Badge>}
              <CardHeader className={cn('pb-4', compact ? 'p-5' : 'p-6')}>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className={cn('min-h-[2.5rem] transition-colors duration-500', key === 'premium' && 'text-pricing-premium-foreground/70')}>{plan.tagline}</CardDescription>
                <div key={`${key}-${cycle}`} className="min-h-[4.5rem] pt-3 pricing-price-fade">
                  {paid ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-1"><span className="text-4xl font-bold">{billedPrice ?? (storeLoading ? 'Loading price…' : 'Unavailable')}</span>{billedPrice && <span className="text-lg font-semibold">{cycle === 'annual' ? '/year' : '/month'}</span>}</div>
                      {billedPrice && <p className={cn('mt-1 text-xs text-muted-foreground', key === 'premium' && 'text-pricing-premium-foreground/60')}>{cycle === 'annual' ? 'Billed in full yearly · Auto-renews yearly' : 'Billed monthly · Auto-renews monthly'}</p>}
                      {!native && cycle === 'annual' && plan.annualMonthlyEquivalent !== null && <p className={cn('mt-1 text-xs text-muted-foreground', key === 'premium' && 'text-pricing-premium-foreground/60')}>Equivalent to ${money(plan.annualMonthlyEquivalent)}/month</p>}
                    </>
                  ) : <><div className="text-4xl font-bold">Free</div><p className="mt-1 text-xs text-muted-foreground">No payment required</p></>}
                </div>
              </CardHeader>
              <CardContent className={cn('flex flex-1 flex-col', compact ? 'p-5 pt-0' : 'p-6 pt-0')}>
                {(key === 'advanced' || key === 'premium') && (
                  <div className={cn('mb-5 grid grid-cols-2 gap-1 rounded-md p-1 transition-colors duration-500', premium ? 'bg-pricing-premium-foreground/10' : 'bg-pricing/10')} role="radiogroup" aria-label="Support level">
                    <Button type="button" size="sm" variant="ghost" className={cn('transition-all duration-300', !premium ? 'bg-pricing text-pricing-foreground shadow hover:bg-pricing-hover hover:text-pricing-foreground' : 'text-pricing-premium-foreground/70 hover:bg-pricing-premium-foreground/10 hover:text-pricing-premium-foreground')} onClick={() => { premiumTouched.current = true; setPremium(false); }} role="radio" aria-checked={!premium}>Advanced</Button>
                    <Button type="button" size="sm" variant="ghost" className={cn('transition-all duration-300', premium ? 'bg-pricing text-pricing-foreground shadow hover:bg-pricing-hover hover:text-pricing-foreground' : 'text-muted-foreground hover:bg-pricing/10 hover:text-pricing')} onClick={() => { premiumTouched.current = true; setPremium(true); }} role="radio" aria-checked={premium}>Premium</Button>
                  </div>
                )}
                {key === 'premium' ? (
                  <div key={`${key}-intro`} className="mb-4 border-t border-pricing-premium-foreground/20 pt-4 pricing-feature-drop">
                    <p className="flex items-center gap-2 font-semibold text-pricing-premium-foreground"><Plus className="h-4 w-4 text-pricing" /> Premium add-ons</p>
                  </div>
                ) : plan.featureIntro ? <p key={`${key}-intro`} className="mb-3 text-sm font-semibold pricing-feature-drop">{plan.featureIntro}</p> : null}
                <ul key={`${key}-features`} className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((feature, index) => <li key={feature} className="flex items-start gap-2 text-sm pricing-feature-drop" style={{ animationDelay: `${Math.min(index * 18, 240)}ms` }}>{key === 'premium' ? <Plus className="mt-0.5 h-4 w-4 flex-shrink-0 text-pricing" /> : <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-pricing" />}<PlanFeatureLabel feature={feature} /></li>)}
                </ul>
                <Button className={cn('w-full transition-all duration-300', paid && 'bg-pricing text-pricing-foreground shadow-md shadow-pricing/20 hover:bg-pricing-hover hover:text-pricing-foreground hover:shadow-lg')} size="lg" variant={key === 'starter' ? 'outline' : 'default'} disabled={current || (native && paid && !storeOption?.available)} onClick={() => paid ? onSelect(checkoutPlanFor(key, cycle)) : onStarter?.()}>
                  {current ? <><Crown className="mr-2 h-4 w-4" />Current plan</> : paid ? 'Subscribe' : 'Get Started'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {isNativeApp() && (
        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={() => void restore()} disabled={purchasing !== null}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Restore purchases
          </Button>
        </div>
      )}
    </div>
  );
};

export default SaasPricingCards;