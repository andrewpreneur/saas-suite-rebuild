import { useCallback, useEffect, useRef, useState } from "react";
import { appendTrackingParams } from "@/utils/preserveParams";
import { redirectAfterPurchase as postPurchaseRedirect } from "@/utils/postPurchase";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, CheckCircle } from "lucide-react";
import { getStoredFbclid, captureFbCookies, readCheckoutAttribution, persistAttribution } from "@/utils/fbAttribution";
import { isNativeApp } from "@/utils/nativeApp";
import { useToast } from "@/hooks/use-toast";
import { storeProductIdForCheckout } from "@/config/storeProducts";
import { checkoutAttributionForTrial } from "@/lib/webinarCheckoutAttribution";
import { initStoreBilling, loadStoreOfferings, purchaseStorePackage } from "@/lib/revenuecat";
import type { CheckoutPlan } from '@/constants/pricingPlans';

const LIVE_PK = "pk_live_51MjPyIGdZ9PRE3ZipiIrE9ZxAF9obgIObU1VX1MgwWuh3SpFaq0nTZH8VLPDzrs0N9JREHGq0hnyGm1Kpd20Ev1I00UQDvqjfC";
const TEST_PK = "pk_test_51MjPyIGdZ9PRE3ZiEoPmbp2o6MEhsqy1sFUGXa3ucLsfcEpBSNQB9tHQCVQ7uL5UcjwuvgiFLtO3MSGQQ3FDT2Vq00L1BhnfJW";

let stripeCache: { testMode: boolean; promise: Promise<import("@stripe/stripe-js").Stripe | null> } | null = null;

/**
 * Stripe.js only. The library downloads itself on import, so this dynamic
 * import is the first moment the script is allowed to load. It does not
 * create a Checkout Session. Safe to call from a CTA hover.
 */
export function prefetchEmbeddedStripe(testMode = false) {
  if (typeof window === "undefined" || isNativeApp()) return Promise.resolve(null);
  if (!stripeCache || stripeCache.testMode !== testMode) {
    stripeCache = {
      testMode,
      promise: import("@stripe/stripe-js").then(({ loadStripe }) => loadStripe(testMode ? TEST_PK : LIVE_PK)),
    };
  }
  return stripeCache.promise;
}

interface StripeEmbeddedCheckoutProps {
  plan: CheckoutPlan | "special";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Render the checkout inside the page instead of inside a dialog. */
  inline?: boolean;
  onComplete?: (purchasedEmail?: string | null, stripeSessionId?: string | null) => void;
  email?: string;
  testMode?: boolean;
  affiliateId?: string | null;
  /** 40% off bump promo code to auto-apply. */
  promoCode?: string | null;
  /** Add the one-time $30 white-label call to this order. */
  addonCall?: boolean;
  /**
   * Skip the automatic redirect after payment so the caller can show a
   * post-purchase upsell first. The caller is then responsible for routing.
   */
  suppressRedirect?: boolean;
  /** Trial campaign marker; eligibility is enforced server-side. */
  trialSource?: string;
}

const StripeEmbeddedCheckout = ({
  plan,
  open,
  onOpenChange,
  inline = false,
  onComplete,
  email,
  testMode = false,
  affiliateId,
  promoCode,
  addonCall = false,
  suppressRedirect = false,
  trialSource,
}: StripeEmbeddedCheckoutProps) => {
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [storeSignedIn, setStoreSignedIn] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const storePurchaseFor = useRef<string | null>(null);
  const { toast } = useToast();
  const onOpenChangeRef = useRef(onOpenChange);
  const onCompleteRef = useRef(onComplete);
  onOpenChangeRef.current = onOpenChange;
  onCompleteRef.current = onComplete;

  // Inside the app the plan was already chosen on the package list, so this
  // opens Apple's payment sheet directly instead of a second plan dialog.
  useEffect(() => {
    if (!open) {
      storePurchaseFor.current = null;
      return;
    }
    if (!isNativeApp() || storePurchaseFor.current === plan) return;
    storePurchaseFor.current = plan;

    void (async () => {
      const productId = storeProductIdForCheckout(plan);
      if (!productId) {
        toast({ title: "This offer is available on the website." });
        onOpenChangeRef.current(false);
        return;
      }

      const ready = await initStoreBilling(email);
      const offerings = ready ? await loadStoreOfferings() : [];
      const match = offerings.find((item) => item.productId === productId);
      if (!match) {
        toast({ title: "That plan is not available in the App Store right now.", variant: "destructive" });
        onOpenChangeRef.current(false);
        return;
      }

      const result = await purchaseStorePackage(match.pkg);
      if (result.ok) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          try { localStorage.setItem("ss_pending_store_purchase", "1"); } catch { /* ignore */ }
        }
        if (suppressRedirect) {
          if (data.session) await supabase.functions.invoke("sync-store-subscription");
          window.dispatchEvent(new Event("ss-store-purchase"));
          onCompleteRef.current?.(email?.trim().toLowerCase() || null, null);
          onOpenChangeRef.current(false);
          return;
        }
        // Show Payment Successful first. Account sync and the page reload wait
        // until the person taps Go to Dashboard, so nothing refreshes underneath.
        setStoreSignedIn(Boolean(data.session));
        setCompleted(true);
        return;
      }

      if (!result.cancelled) {
        toast({ title: result.error ?? "Purchase failed", variant: "destructive" });
      }
      onOpenChangeRef.current(false);
    })();
  }, [open, plan, email, suppressRedirect, toast]);

  const [stripePromise, setStripePromise] = useState<ReturnType<typeof prefetchEmbeddedStripe> | null>(null);
  const [stripeUi, setStripeUi] = useState<typeof import("@stripe/react-stripe-js") | null>(null);
  useEffect(() => {
    if (!open || isNativeApp()) return;
    let cancelled = false;
    void Promise.all([prefetchEmbeddedStripe(testMode), import("@stripe/react-stripe-js")]).then(([stripe, ui]) => {
      if (cancelled || !stripe) return;
      setStripePromise(Promise.resolve(stripe));
      setStripeUi(ui);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Checkout couldn't load.");
    });
    return () => { cancelled = true; };
  }, [open, testMode]);

  const redirectAfterPurchase = useCallback(async (purchasedEmail?: string | null) => {
    await postPurchaseRedirect(purchasedEmail, sessionIdRef.current);
  }, []);


  const fetchClientSecret = useCallback(async () => {
    setError(null);
    const attribution = readCheckoutAttribution(plan);
    if (email) void persistAttribution(email);
    const { data, error: fnError } = await supabase.functions.invoke(
      "create-checkout",
      {
        body: {
          plan,
          email,
          testMode,
          affiliateId: affiliateId || undefined,
          promoCode: promoCode || undefined,
          addonCall: addonCall || undefined,
          trialSource: trialSource || undefined,
          attribution: checkoutAttributionForTrial(attribution, trialSource),
        },
      }
    );

    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    if (!data?.clientSecret) throw new Error("Missing checkout client secret");

    sessionIdRef.current = data.sessionId ?? null;
    return data.clientSecret as string;
  }, [plan, email, testMode, affiliateId, promoCode, addonCall, trialSource]);

  const handleComplete = useCallback(async () => {
    const priceByPlan: Record<CheckoutPlan | "special", number> = {
      basic: 27, basic_annual: 240, advanced: 97, advanced_annual: 870,
      enhanced: 297, enhanced_annual: 2670, special: 997,
    };
    const price = priceByPlan[plan];
    let purchasedEmail = email?.trim().toLowerCase() || null;
    const fbclid = getStoredFbclid();
    const { fbc, fbp } = captureFbCookies();
    const attribution = readCheckoutAttribution(plan);
    const checkoutPage = attribution.checkout_page ||
      (typeof window !== "undefined" ? window.location.pathname + window.location.search : "");

    const contentName =
      plan === "enhanced" || plan === "enhanced_annual"
        ? "Premium Support"
        : plan === "special"
          ? "SaaSSuite $997 Annual Offer"
        : plan === "advanced" || plan === "advanced_annual"
          ? "Advanced Plan"
          : "Basic Plan";

    // Fires the browser pixel AND the server-side Conversions API with a shared
    // event_id so Meta counts one Purchase and keeps the better-matched copy.
    try {
      const { trackPurchase } = await import("@/utils/metaCapi");
      // Shared dedup key with the server: order_<stripe session id>. The Stripe
      // webhook and notify-stripe-purchase send the exact same event_id.
      // NEVER fall back to a constant: two different customers sharing one
      // event_id makes Meta collapse them into a single Purchase, under-counting
      // real orders. Unique-per-order fallback keeps them distinct.
      const purchaseEventId = `order_${
        sessionIdRef.current ??
        (purchasedEmail
          ? purchasedEmail.replace(/[^a-z0-9]/g, "_")
          : `nosession_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
      }`;
      await trackPurchase(purchasedEmail, price, contentName, purchaseEventId);
    } catch (e) {
      console.error("[StripeCheckout] Meta conversion error:", e);
    }

    try {
      if (sessionIdRef.current) {
        const { data: notifyData, error: notifyError } = await supabase.functions.invoke(
          "notify-stripe-purchase",
          {
            body: {
              sessionId: sessionIdRef.current,
              plan,
              testMode,
              fallbackEmail: email,
              affiliateId: affiliateId || undefined,
              fbclid: fbclid || undefined,
              fbc: fbc || undefined,
              fbp: fbp || undefined,
              attribution,
              checkoutPage,
            },
          }
        );

        if (notifyError) {
          throw new Error(notifyError.message);
        }

        purchasedEmail = notifyData?.email?.trim().toLowerCase() || purchasedEmail;
      } else {
        await fetch("https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c17588f8-b1e7-4559-9695-f848be562692", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email || "",
            plan: plan === "special" ? "SaaSSuite $997 Annual Offer" : plan.startsWith("enhanced") ? "Premium Support" : plan.startsWith("advanced") ? "Advanced" : "Basic",
            price,
            fbclid: fbclid || "",
            utm_source: attribution.utm_source || "",
            utm_medium: attribution.utm_medium || "",
            utm_campaign: attribution.utm_campaign || "",
            utm_term: attribution.utm_term || "",
            utm_content: attribution.utm_content || "",
            utm_id: attribution.utm_id || "",
            gclid: attribution.gclid || "",
            referrer: attribution.referrer || "",
            landing_page: attribution.landing_page || "",
            last_landing_page: attribution.last_landing_page || "",
            last_referrer: attribution.last_referrer || "",
            last_utm_source: attribution.last_utm_source || "",
            last_utm_medium: attribution.last_utm_medium || "",
            last_utm_campaign: attribution.last_utm_campaign || "",
            last_utm_term: attribution.last_utm_term || "",
            last_utm_content: attribution.last_utm_content || "",
            last_fbclid: attribution.last_fbclid || "",
            last_gclid: attribution.last_gclid || "",
            last_touch_at: attribution.last_touch_at || "",
            checkout_surface: attribution.checkout_surface || "",
            checkout_page: checkoutPage,
          }),
        });
      }
    } catch (e) {
      console.error("[StripeCheckout] Webhook error:", e);
    }

    onComplete?.(purchasedEmail, sessionIdRef.current);
    if (!suppressRedirect) {
      await redirectAfterPurchase(purchasedEmail);
    }
  }, [plan, email, onComplete, testMode, redirectAfterPurchase, suppressRedirect]);

  const handleClose = () => {
    sessionIdRef.current = null;
    setCompleted(false);
    setStoreSignedIn(false);
    setError(null);
    onOpenChange(false);
  };

  const [finishing, setFinishing] = useState(false);
  const finishStorePurchase = async () => {
    setFinishing(true);
    if (storeSignedIn) {
      try { await supabase.functions.invoke("sync-store-subscription"); } catch { /* linker retries */ }
    }
    onCompleteRef.current?.(email?.trim().toLowerCase() || null, null);
    window.location.replace(appendTrackingParams(storeSignedIn ? "/app" : "/signup"));
  };

  const checkoutContent = completed ? (
    <div className="text-center py-8">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold mb-2">Payment Successful!</h3>
      <p className="text-muted-foreground mb-6">
        Your subscription is now active.
      </p>
      <Button disabled={finishing} onClick={isNativeApp() ? () => { void finishStorePurchase(); } : () => { window.location.replace(appendTrackingParams("/app")); }}>
        {isNativeApp() && !storeSignedIn ? "Create your account" : "Go to Dashboard"}
      </Button>
    </div>
  ) : error ? (
    <div className="text-center text-destructive py-8" role="alert">
      <p>{error}</p>
      <Button variant="outline" className="mt-4" onClick={() => setError(null)}>
        Try Again
      </Button>
    </div>
  ) : stripePromise && stripeUi ? (
    <stripeUi.EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{ fetchClientSecret, onComplete: handleComplete }}
    >
      <stripeUi.EmbeddedCheckout />
    </stripeUi.EmbeddedCheckoutProvider>
  ) : (
    <p role="status" className="py-8 text-center text-muted-foreground">Loading secure checkout…</p>
  );

  if (!open || (isNativeApp() && !completed)) return null;

  if (inline) {
    return (
      <div className="min-h-[520px] w-full bg-background p-3 sm:p-5" aria-label="Secure checkout">
        {checkoutContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DialogTitle className="font-semibold text-lg">
            {completed
              ? "Payment Successful"
              : plan.startsWith("enhanced")
                ? "Subscribe – Premium Support"
                : plan === "special"
                  ? "Get the SaaSSuite Annual Offer"
                : `Subscribe – ${plan.startsWith("advanced") ? "Advanced" : "Basic"} Plan`}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          {checkoutContent}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StripeEmbeddedCheckout;
