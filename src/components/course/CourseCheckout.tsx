import { useCallback, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, X } from "lucide-react";
import { getStoredAttribution, getStoredFbclid, captureFbCookies } from "@/utils/fbAttribution";

const LIVE_PK =
  "pk_live_51MjPyIGdZ9PRE3ZipiIrE9ZxAF9obgIObU1VX1MgwWuh3SpFaq0nTZH8VLPDzrs0N9JREHGq0hnyGm1Kpd20Ev1I00UQDvqjfC";
const TEST_PK =
  "pk_test_51MjPyIGdZ9PRE3ZiEoPmbp2o6MEhsqy1sFUGXa3ucLsfcEpBSNQB9tHQCVQ7uL5UcjwuvgiFLtO3MSGQQ3FDT2Vq00L1BhnfJW";

export type CourseKey = "first_client" | "agency_freedom";

interface CourseCheckoutProps {
  course: CourseKey;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string | null;
  testMode?: boolean;
}

/** Embedded Stripe checkout for the one-time $27 course products. */
const CourseCheckout = ({
  course,
  title,
  open,
  onOpenChange,
  email,
  testMode = false,
}: CourseCheckoutProps) => {
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const stripePromise = useMemo(() => loadStripe(testMode ? TEST_PK : LIVE_PK), [testMode]);

  const fetchClientSecret = useCallback(async () => {
    setError(null);
    const attribution = getStoredAttribution();
    const fbclid = getStoredFbclid();
    const { fbc, fbp } = captureFbCookies();
    const { data, error: fnError } = await supabase.functions.invoke("create-course-checkout", {
      body: {
        course,
        email: email || undefined,
        testMode,
        attribution: {
          ...attribution,
          fbclid: fbclid || undefined,
          fbc: fbc || undefined,
          fbp: fbp || undefined,
        },
      },
    });
    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    if (!data?.clientSecret) throw new Error("Missing checkout client secret");
    sessionIdRef.current = data.sessionId ?? null;
    return data.clientSecret as string;
  }, [course, email, testMode]);

  const handleComplete = useCallback(async () => {
    setCompleted(true);
    try {
      const { trackPurchase } = await import("@/utils/metaCapi");
      const purchaseEventId = `order_${
        sessionIdRef.current ??
        `course_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      }`;
      await trackPurchase(email || null, 27, title, purchaseEventId);
    } catch (e) {
      console.error("[CourseCheckout] Meta conversion error:", e);
    }
  }, [email, title]);

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
          <h3 className="text-lg font-semibold">
            {completed ? "Payment Successful" : `${title} — $27`}
          </h3>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          {completed ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
              <h4 className="mb-2 text-2xl font-bold">You're in!</h4>
              <p className="mb-6 text-muted-foreground">
                Check your email — your course access and downloads are on the way.
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

export default CourseCheckout;
