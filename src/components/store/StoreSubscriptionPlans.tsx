import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { useStoreSubscription } from '@/hooks/useStoreSubscription';
import PlanFeatureLabel from '@/components/pricing/PlanFeatureLabel';

interface StoreSubscriptionPlansProps {
  /** Shown as a short line above the plans. */
  intro?: string;
  onPurchased?: () => void;
}

/**
 * Subscription picker for the iOS / Android apps. Purchases run through the
 * App Store / Google Play — no card checkout is ever shown inside the app.
 *
 * Customers who already pay on the website see a confirmation instead of plans.
 */
const StoreSubscriptionPlans = ({ intro, onPurchased }: StoreSubscriptionPlansProps) => {
  const {
    loading,
    purchasing,
    options,
    hasStoreSubscription,
    hasWebSubscription,
    error,
    purchase,
    restore,
  } = useStoreSubscription();
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const intervalTouched = useRef(false);
  useEffect(() => {
    if (intervalTouched.current) return;
    const ownedPlans = options.filter((option) => option.owned && option.entitlement !== 'agency_seat');
    if (ownedPlans.length === 0) return;
    const months = ownedPlans.some((option) => option.interval === 'month');
    const years = ownedPlans.some((option) => option.interval === 'year');
    if (years && !months) setInterval('year');
    else if (months && !years) setInterval('month');
  }, [options]);
  const planOptions = options.filter((option) => option.entitlement !== 'agency_seat' && option.interval === interval);
  const seat = options.find((option) => option.productId === 'ss_agency_seat_monthly');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (hasWebSubscription) {
    return (
      <div className="text-center py-8 space-y-2">
        <Check className="h-10 w-10 text-primary mx-auto" />
        <h3 className="text-lg font-semibold">Your subscription is active</h3>
        <p className="text-sm text-muted-foreground">
          Your plan is already active on this account, so there's nothing to buy here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {intro && <p className="text-sm text-muted-foreground text-center">{intro}</p>}

      {error && (
        <p className="text-sm text-destructive text-center" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant={interval === 'month' ? 'default' : 'outline'} onClick={() => { intervalTouched.current = true; setInterval('month'); }}>
          Monthly
        </Button>
        <Button variant={interval === 'year' ? 'default' : 'outline'} onClick={() => { intervalTouched.current = true; setInterval('year'); }}>
          Yearly
        </Button>
      </div>

      {interval === 'month' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Starter</CardTitle>
            <CardDescription>Everything you need to start. No payment.</CardDescription>
            <div className="pt-2">
              <span className="text-2xl font-bold">Free</span>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full" size="lg" asChild>
              <a href="/signup">Get started</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {planOptions.map((option) => (
        <Card
          key={option.productId}
          className={option.highlight ? 'border-2 border-primary' : undefined}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">{option.name}</CardTitle>
              {option.owned && <Badge>Your plan</Badge>}
            </div>
            <div className="pt-2">
              <span className="text-3xl font-bold">{option.displayPrice}</span>{' '}
              <span className="text-lg font-semibold">{option.period}</span>
            </div>
            <p className="text-xs text-muted-foreground">{option.interval === 'year' ? 'Billed in full yearly · Auto-renews yearly' : 'Billed monthly · Auto-renews monthly'}</p>
            <CardDescription>{option.blurb}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1.5">
              {option.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <PlanFeatureLabel feature={feature} />
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              size="lg"
              disabled={option.owned || !option.available || purchasing !== null}
              onClick={async () => {
                const result = await purchase(option.productId);
                if (result.ok) onPurchased?.();
              }}
            >
              {purchasing === option.productId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : option.owned ? (
                'Current plan'
              ) : !option.available ? (
                'Unavailable'
              ) : (
                `Subscribe – ${option.displayPrice} ${option.period}`
              )}
            </Button>
          </CardContent>
        </Card>
      ))}

      {seat && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">{seat.name}</CardTitle>
              {seat.owned && <Badge>Your seat</Badge>}
            </div>
            <CardDescription>{seat.blurb}</CardDescription>
            <div className="pt-2">
              <span className="text-2xl font-bold">{seat.displayPrice}</span>{' '}
              <span className="text-sm text-muted-foreground">{seat.period}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              size="lg"
              disabled={seat.owned || !seat.available || purchasing !== null}
              onClick={async () => {
                const result = await purchase(seat.productId);
                if (result.ok) onPurchased?.();
              }}
            >
              {purchasing === seat.productId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : seat.owned ? (
                'Current seat'
              ) : !seat.available ? (
                'Unavailable'
              ) : (
                `Subscribe – ${seat.displayPrice} ${seat.period}`
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={() => void restore()} disabled={purchasing !== null}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Restore purchases
        </Button>
      </div>

      {!hasStoreSubscription && (
        <p className="text-xs text-muted-foreground text-center">
          Billed through your app store account. Cancel anytime in your store subscription settings.
        </p>
      )}
    </div>
  );
};

export default StoreSubscriptionPlans;
