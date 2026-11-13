import { currentSiteAnalyticsSessionId } from "@/components/siteFunnelPageview";
import { supabase } from "@/integrations/supabase/client";
import { isKitPostPurchaseId, type KitPostPurchaseId } from "../../../supabase/functions/_shared/kit-catalog";
import { kitFunnelSessionId } from "./events";
import { completeCheckout, type KitBumps, type KitDraft } from "./order";
import { kitBrowserTracking, kitCheckoutUtms } from "./tracking";

export type KitCheckoutStart = {
  clientSecret: string;
  sessionId: string;
  leadEventId: string;
  initiateCheckoutEventId: string;
};

export type KitCheckoutConfirmation = {
  draft: KitDraft;
  amountTotal: number;
  comped: boolean;
};

export type KitChargeResult = { paid: true; comped: boolean; alreadyOwned?: boolean; paymentIntentId?: string };

export type KitEntitlements = {
  lineIds: string[];
  customerId?: string;
  paymentMethodId?: string;
  comped: boolean;
};

export const KIT_PAYMENT_CAPABILITY_KEY = "ofk-payment-capability";
const CAPABILITY_KEY = KIT_PAYMENT_CAPABILITY_KEY;
export function kitPaymentCapability(create = false): string {
  let existing: string | null = null;
  try {
    existing = sessionStorage.getItem(CAPABILITY_KEY);
  } catch {
    existing = null;
  }
  if (existing) return existing;
  if (!create) throw new Error("Return to checkout in the browser where you placed your order.");
  const value = crypto.randomUUID();
  try {
    sessionStorage.setItem(CAPABILITY_KEY, value);
  } catch {
    /* Safari private mode and a full quota throw on setItem. The request still uses this value. */
  }
  return value;
}
async function invokePayment(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("one-feature-kit-payment", { body });
  if (error) {
    let message = "We couldn't confirm the payment. Please try again.";
    if (error.context instanceof Response) {
      const result = await error.context.json().catch(() => null);
      if (typeof result?.error === "string") message = result.error;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const KIT_PROMO_INVALID = "That code isn't valid";
export type KitPromoQuote = { percentOff: number | null; amountOff: number | null };
export async function lookupKitPromotion(code: string): Promise<KitPromoQuote> {
  const result = await invokePayment({ action: "promo", capability: kitPaymentCapability(true), promotionCode: code.trim() });
  if (result?.ok !== true) throw new Error(KIT_PROMO_INVALID);
  return {
    percentOff: typeof result.percentOff === "number" ? result.percentOff : null,
    amountOff: typeof result.amountOff === "number" ? result.amountOff : null,
  };
}
export async function createKitCheckout(contact: KitDraft["contact"], bumps: KitBumps, promotionCode?: string): Promise<KitCheckoutStart> {
  const code = promotionCode?.trim();
  const utm = kitCheckoutUtms();
  const ofkSessionId = kitFunnelSessionId();
  const siteSessionId = currentSiteAnalyticsSessionId();
  const result = await invokePayment({
    action: "create",
    capability: kitPaymentCapability(true),
    contact,
    bumps,
    tracking: { ...kitBrowserTracking(), ...utm },
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    ...(ofkSessionId ? { ofk_session_id: ofkSessionId } : {}),
    ...(siteSessionId ? { site_session_id: siteSessionId } : {}),
    ...(code ? { promotionCode: code } : {}),
  });
  if (typeof result?.clientSecret !== "string" || !result.clientSecret.includes("_secret_")) throw new Error("Secure checkout is unavailable. Please try again.");
  return {
    clientSecret: result.clientSecret,
    sessionId: typeof result.sessionId === "string" ? result.sessionId : "",
    leadEventId: typeof result.leadEventId === "string" ? result.leadEventId : "",
    initiateCheckoutEventId: typeof result.initiateCheckoutEventId === "string" ? result.initiateCheckoutEventId : "",
  };
}
export async function confirmKitCheckout(draft: KitDraft, sessionId: string): Promise<KitCheckoutConfirmation> {
  const result = await invokePayment({ action: "verify", capability: kitPaymentCapability(), sessionId });
  if (result?.checkoutId !== sessionId || !result.customerId) throw new Error("Payment isn't confirmed. Please return to checkout.");
  if (!result.paymentMethodId && result.comped !== true) throw new Error("Payment isn't confirmed. Please return to checkout.");
  return {
    draft: { ...completeCheckout(draft, result.contact, result.bumps, result.checkoutId), customerId: result.customerId, paymentMethodId: result.paymentMethodId ?? undefined },
    amountTotal: typeof result.amountTotal === "number" ? result.amountTotal : 0,
    comped: result.comped === true,
  };
}
function verifiedLineIds(result: { lineIds?: unknown; contentIds?: unknown }): string[] {
  const raw = Array.isArray(result.lineIds) ? result.lineIds : result.contentIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && (id === "kit" || isKitPostPurchaseId(id)));
}

/** Checkout lines plus later add-ons saved for this session. The browser capability is required. */
export async function loadKitEntitlements(sessionId: string): Promise<KitEntitlements> {
  const result = await invokePayment({ action: "verify", capability: kitPaymentCapability(), sessionId });
  if (result?.checkoutId !== sessionId) throw new Error("Payment isn't confirmed. Please return to checkout.");
  const lineIds = verifiedLineIds(result);
  if (!lineIds.includes("kit")) throw new Error("Payment isn't confirmed. Please return to checkout.");
  return {
    lineIds,
    customerId: typeof result.customerId === "string" ? result.customerId : undefined,
    paymentMethodId: typeof result.paymentMethodId === "string" ? result.paymentMethodId : undefined,
    comped: result.comped === true,
  };
}

export async function chargeKitOffer(draft: KitDraft, offerId: KitPostPurchaseId): Promise<KitChargeResult> {
  if (!draft.checkoutId?.startsWith("cs_live_")) throw new Error("Return to checkout to pay for your kit first.");
  const pageUrl = typeof window !== "undefined" ? window.location.href.slice(0, 500) : "";
  const result = await invokePayment({ action: "upsell", capability: kitPaymentCapability(), sessionId: draft.checkoutId, offerId, ...(pageUrl ? { page_url: pageUrl } : {}) });
  if (result?.paid !== true) throw new Error("Your card wasn't charged. Nothing was added.");
  return {
    paid: true,
    comped: result.comped === true,
    alreadyOwned: result.alreadyOwned === true,
    paymentIntentId: typeof result.paymentIntentId === "string" ? result.paymentIntentId : undefined,
  };
}