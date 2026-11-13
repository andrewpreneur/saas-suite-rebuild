import { useCallback, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, X } from "lucide-react";

const LIVE_PK =
  "pk_live_51MjPyIGdZ9PRE3ZipiIrE9ZxAF9obgIObU1VX1MgwWuh3SpFaq0nTZH8VLPDzrs0N9JREHGq0hnyGm1Kpd20Ev1I00UQDvqjfC";
const TEST_PK =
  "pk_test_51MjPyIGdZ9PRE3ZiEoPmbp2o6MEhsqy1sFUGXa3ucLsfcEpBSNQB9tHQCVQ7uL5UcjwuvgiFLtO3MSGQQ3FDT2Vq00L1BhnfJW";

interface AddonEmbeddedCheckoutProps {
  product: "strategy_call" | "white_label_call";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string | null;
  testMode?: boolean;
  onComplete?: (sessionId: string | null) => void;
}

const TITLES: Record<AddonEmbeddedCheckoutProps["product"], string> = {
  strategy_call: "1:1 Strategy & Coaching Call — $150",
  white_label_call: "White-Label Call — $30",
};

/** Embedded Stripe checkout for the one-time add-on products. */
const AddonEmbeddedCheckout = ({
  product,
  open,
  onOpenChange,
  email,
  testMode = false,
  onComplete,
}: AddonEmbeddedCheckoutProps) => {
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const stripePromise = useMemo(() => loadStripe(testMode ? TEST_PK : LIVE_PK), [testMode]);

  const fetchClientSecret = useCallback(async () => {
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("create-addon-checkout", {
      body: { product, email: email || undefined, testMode },
    });
    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    if (!data?.clientSecret) throw new Error("Missing checkout client secret");
    sessionIdRef.current = data.sessionId ?? null;
    return data.clientSecret as string;
  }, [product, email, testMode]);

  const handleComplete = useCallback(() => {
    setCompleted(true);
    onComplete?.(sessionIdRef.current);
  }, [onComplete]);

  const close = () => {
    sessionIdRef.current = null;
    setCompleted(false);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl [&>button]:hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold">{completed ? "Payment Successful" : TITLES[product]}</h3>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          {completed ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
              <p className="mb-6 text-muted-foreground">
                You're all set — our team will reach out to schedule your call.
              </p>
              <Button onClick={close}>Continue</Button>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => setError(null)}>
                Try Again
              </Button>
            </div>
          ) : (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret, onComplete: handleComplete }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddonEmbeddedCheckout;
