import { cn } from '@/lib/utils';
import type { PricingMode } from '@/constants/pricingPlans';
import { SAAS_PITCH, AGENCY_PITCH } from '@/constants/pricingPlans';

interface Props {
  value: PricingMode;
  onChange: (mode: PricingMode) => void;
  className?: string;
  /** Hide the descriptive pitch line below the toggle. */
  hidePitch?: boolean;
}

export function PricingModeToggle({ value, onChange, className, hidePitch }: Props) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        role="tablist"
        aria-label="Pricing type"
        className="inline-flex items-center rounded-full border border-border bg-muted p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === 'saas'}
          onClick={() => onChange('saas')}
          className={cn(
            'px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition-all',
            value === 'saas'
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          SaaS Support
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === 'agency'}
          onClick={() => onChange('agency')}
          className={cn(
            'px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition-all',
            value === 'agency'
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Agency Support
        </button>
      </div>
      {!hidePitch && (
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {value === 'saas' ? SAAS_PITCH : AGENCY_PITCH}
        </p>
      )}
    </div>
  );
}

export default PricingModeToggle;