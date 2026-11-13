import InfoTip from "@/components/ui/info-tip";
import { featureInfoFor } from "@/constants/pricingPlans";
import { cn } from "@/lib/utils";

/** Renders a plan feature, with the shared info icon when that feature has a note. */
export function PlanFeatureLabel({ feature, className }: { feature: string; className?: string }) {
  const info = featureInfoFor(feature);
  return (
    <span className={cn("inline", className)}>
      {feature}
      {info ? (
        <InfoTip className="ml-1" label={`About ${feature}`}>
          {info}
        </InfoTip>
      ) : null}
    </span>
  );
}

export default PlanFeatureLabel;
