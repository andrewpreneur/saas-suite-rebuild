import { useCallback, useState, useEffect } from "react";
import { CheckoutProvider, AutoCheckout } from "@fanbasis/checkout-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { getStoredAttribution, getStoredFbclid } from "@/utils/fbAttribution";

interface FanbasisEmbeddedCheckoutProps {
  productId: string;
  creatorId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  label?: string;
}

const FanbasisEmbeddedCheckout = ({
  productId,
  creatorId = "",
  open,
  onOpenChange,
  onComplete,
  label = "Checkout",
}: FanbasisEmbeddedCheckoutProps) => {
  const [error, setError] = useState<string | null>(null);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSecret = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const attribution = getStoredAttribution();
      const fbclid = getStoredFbclid();
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-fanbasis-checkout",
        {
          body: {
            productId,
            attribution: {
              ...attribution,
              fbclid: fbclid || undefined,
              checkout_page:
                typeof window !== "undefined"
                  ? window.location.pathname + window.location.search
                  : undefined,
            },
          },
        }
      );
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.checkoutSecret) throw new Error("No checkout secret returned");
      setCheckoutSecret(data.checkoutSecret);
    } catch (e: any) {
      setError(e.message || "Failed to create checkout");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (open && !checkoutSecret && !loading) {
      fetchSecret();
    }
  }, [open, checkoutSecret, loading, fetchSecret]);

  const handleClose = () => {
    setCheckoutSecret(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0 [&>button]:hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-lg">{label}</h3>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
         <div className="p-4 min-h-[600px] [&_iframe]:!w-full [&_iframe]:!h-[600px] [&_iframe]:!min-h-[600px]">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading checkout...</span>
            </div>
          )}
          {error && !loading && (
            <div className="text-center text-destructive py-8">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => fetchSecret()}>
                Try Again
              </Button>
            </div>
          )}
          {checkoutSecret && !error && !loading && (
            <CheckoutProvider
              config={{
                creatorId: creatorId,
                productId: productId,
                checkoutSessionSecret: checkoutSecret,
                environment: "production",
              }}
            >
              <AutoCheckout
                autoInit={true}
                onSuccess={() => {
                  onComplete?.();
                  handleClose();
                }}
                onError={(err: any) => {
                  console.error("[FanbasisCheckout] Error:", err);
                  setError("Payment failed. Please try again.");
                }}
                style={{ minHeight: "600px", width: "100%" }}
              />
            </CheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FanbasisEmbeddedCheckout;
