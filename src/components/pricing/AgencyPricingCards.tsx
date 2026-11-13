import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { AGENCY_PLANS, AGENCY_FEATURES, AGENCY_BOOKING_URL } from '@/constants/pricingPlans';
import { cn } from '@/lib/utils';

const AGENCY_PER_ACCOUNT = 49;

interface Props {
  /** Style variant to match the surrounding page. */
  variant?: 'landing' | 'panel';
  bookingUrl?: string;
  className?: string;
}

/**
 * Reusable 3-card grid for Agency Support pricing.
 * Presentation-only: all CTAs open the booking URL — white-glove tier is not self-serve.
 */
export function AgencyPricingCards({ variant = 'landing', bookingUrl = AGENCY_BOOKING_URL, className }: Props) {
  const openBooking = () => window.open(bookingUrl, '_blank', 'noopener,noreferrer');
  const [advancedAccounts, setAdvancedAccounts] = useState(10);

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-6', className)}>
      {AGENCY_PLANS.map((plan) => (
        <div
          key={plan.key}
          className={cn(
            'rounded-2xl p-8 border flex flex-col shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]',
            variant === 'landing' ? 'bg-white border-gray-200' : 'bg-card border-border',
            plan.highlight && 'border-primary ring-2 ring-primary/20'
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <h3
              className={cn(
                'text-xl font-semibold',
                variant === 'landing' ? 'text-gray-900' : 'text-foreground'
              )}
            >
              {plan.name}
            </h3>
            {plan.highlight && (
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                Popular
              </span>
            )}
          </div>
          <p
            className={cn(
              'text-sm mb-4',
              variant === 'landing' ? 'text-gray-500' : 'text-muted-foreground'
            )}
          >
            {plan.tagline}
          </p>
          <div className="mb-2 flex items-baseline gap-1">
            <span
              className={cn(
                'text-5xl font-bold',
                variant === 'landing' ? 'text-gray-900' : 'text-foreground'
              )}
            >
              {plan.key === 'advanced'
                ? `$${(advancedAccounts * AGENCY_PER_ACCOUNT).toLocaleString()}`
                : plan.priceDisplay}
            </span>
            {plan.key === 'advanced' ? (
              <span className={variant === 'landing' ? 'text-gray-500' : 'text-muted-foreground'}>
                /month
              </span>
            ) : plan.priceSuffix && (
              <span className={variant === 'landing' ? 'text-gray-500' : 'text-muted-foreground'}>
                {plan.priceSuffix}
              </span>
            )}
          </div>
          {plan.key === 'advanced' ? (
            <div className="mb-6">
              <p
                className={cn(
                  'text-xs mb-3 flex items-center justify-between',
                  variant === 'landing' ? 'text-gray-500' : 'text-muted-foreground'
                )}
              >
                <span>Accounts</span>
                <span className="font-semibold">
                  {advancedAccounts} × ${AGENCY_PER_ACCOUNT}
                </span>
              </p>
              <Slider
                value={[advancedAccounts]}
                min={6}
                max={100}
                step={1}
                onValueChange={(v) => setAdvancedAccounts(v[0])}
              />
              <div
                className={cn(
                  'flex justify-between text-[10px] mt-1',
                  variant === 'landing' ? 'text-gray-400' : 'text-muted-foreground'
                )}
              >
                <span>6</span>
                <span>100</span>
              </div>
            </div>
          ) : plan.note && (
            <p
              className={cn(
                'text-xs mb-6',
                variant === 'landing' ? 'text-gray-500' : 'text-muted-foreground'
              )}
            >
              {plan.note}
            </p>
          )}
          <Button
            onClick={openBooking}
            className={cn(
              'w-full text-base py-5 rounded-xl mb-6',
              variant === 'landing' && 'bg-[#8125D3] hover:bg-[#6f1fb5] text-white'
            )}
          >
            {plan.ctaLabel}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <div className="space-y-3">
            {AGENCY_FEATURES.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <Check
                  className={cn(
                    'w-4 h-4 mt-0.5 flex-shrink-0',
                    variant === 'landing' ? 'text-[#8125D3]' : 'text-primary'
                  )}
                />
                <span
                  className={cn(
                    'text-sm',
                    variant === 'landing' ? 'text-gray-700' : 'text-foreground'
                  )}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AgencyPricingCards;