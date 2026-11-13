import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BillingCycle } from '@/constants/pricingPlans';

interface BillingCycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
}

const BillingCycleToggle = ({ value, onChange, className }: BillingCycleToggleProps) => (
  <div className={cn('flex flex-col items-center gap-3', className)}>
    <div className="inline-flex items-center rounded-full border border-pricing/20 bg-card p-1.5 shadow-sm" role="tablist" aria-label="Billing cycle">
      <Button type="button" variant="ghost" size="sm" className={cn('rounded-full px-5 transition-all duration-300', value === 'monthly' ? 'bg-pricing text-pricing-foreground shadow-md hover:bg-pricing-hover hover:text-pricing-foreground' : 'text-muted-foreground hover:text-foreground')} role="tab" aria-selected={value === 'monthly'} onClick={() => onChange('monthly')}>
        Monthly
      </Button>
      <Button type="button" variant="ghost" size="sm" className={cn('rounded-full px-4 transition-all duration-300', value === 'annual' ? 'bg-pricing text-pricing-foreground shadow-md hover:bg-pricing-hover hover:text-pricing-foreground' : 'text-muted-foreground hover:text-foreground')} role="tab" aria-selected={value === 'annual'} onClick={() => onChange('annual')}>
        Annual <Badge variant="secondary" className={cn('ml-2 whitespace-nowrap transition-colors duration-300', value === 'annual' && 'bg-pricing-foreground/15 text-pricing-foreground')}>Save 25%</Badge>
      </Button>
    </div>
    <p className="text-sm font-medium text-foreground">No contracts. No hidden fees.</p>
  </div>
);

export default BillingCycleToggle;