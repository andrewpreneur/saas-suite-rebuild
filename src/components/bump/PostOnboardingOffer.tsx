import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import PlanBumpOffer from "@/components/bump/PlanBumpOffer";

interface PostOnboardingOfferProps {
  open: boolean;
  email?: string | null;
  testMode?: boolean;
  /** Called when the user declines, closes, or finishes checkout. */
  onContinue: () => void;
}

/**
 * 40% off Basic bump shown right after the initial questions, before the user
 * lands in the platform. Declining (or finishing checkout) continues onboarding.
 */
const PostOnboardingOffer = ({ open, email, testMode = false, onContinue }: PostOnboardingOfferProps) => {
  const [stage, setStage] = useState<"offer" | "checkout">("offer");
  const [promoCode, setPromoCode] = useState<string | null>(null);

  if (!open) return null;

  if (stage === "checkout") {
    return (
      <StripeEmbeddedCheckout
        plan="basic"
        open
        onOpenChange={(v) => !v && onContinue()}
        email={email ?? undefined}
        testMode={testMode}
        promoCode={promoCode}
        suppressRedirect
        onComplete={() => onContinue()}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onContinue()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 gap-0 sm:max-w-2xl [&>button]:hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold">Before you jump in…</h3>
          <Button variant="ghost" size="icon" onClick={onContinue} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          <PlanBumpOffer
            plan="basic"
            email={email}
            testMode={testMode}
            onAccept={(code) => {
              setPromoCode(code);
              setStage("checkout");
            }}
            onDecline={onContinue}
            declineLabel="No thanks, take me to my dashboard"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostOnboardingOffer;