import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Headset, Check } from "lucide-react";

interface CallBumpOfferProps {
  /** Called whenever the customer toggles the add-on. */
  onToggle?: (added: boolean) => void;
  defaultAdded?: boolean;
}

/** Bump shown right before the $97 Advanced purchase. */
const CallBumpOffer = ({ onToggle, defaultAdded = false }: CallBumpOfferProps) => {
  const [added, setAdded] = useState(defaultAdded);

  const toggle = (next: boolean) => {
    setAdded(next);
    onToggle?.(next);
  };

  return (
    <Card
      className={`cursor-pointer border-2 p-5 text-center transition-colors ${
        added
          ? "border-offer bg-offer/10 shadow-[0_0_45px_-8px_hsl(var(--offer)/0.55)] ring-4 ring-offer/20"
          : "border-dashed border-offer/50 hover:border-offer"
      }`}
      onClick={() => toggle(!added)}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={added} onCheckedChange={(v) => toggle(Boolean(v))} className="mt-1" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Headset className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              Get a white-label onboarding or support call for one of your customers right now — 50% off
            </span>
            <Badge variant="secondary">50% off</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Our US team runs the call under your brand. One-time add-on, charged with this order.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">$30</span>
            <span className="text-sm text-muted-foreground line-through">$60</span>
          </div>
          {added && (
            <p className="flex items-center justify-center gap-1 text-sm font-medium text-success">
              <Check className="h-4 w-4" /> Added to your order
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CallBumpOffer;