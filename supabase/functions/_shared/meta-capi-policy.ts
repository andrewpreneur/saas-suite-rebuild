/**
 * Meta CAPI request policy shared by the meta-capi function.
 * Purchase is not a public browser event: the caller must be the service role
 * (Stripe webhooks) or the event_id must match a paid Stripe charge.
 * A completed $0 subscription trial is sent at Stripe's recurring plan price.
 */
import { hostAllowed, hostOf } from "./pixel-host.ts";
export {
  cookieIsTest,
  metaSendPlan,
  metaTestEventCode,
  metadataIsTest,
  missingIsTestColumn,
  objectIsTest,
  requestIsTest,
  valueIsTest,
} from "./test-traffic.ts";

export const META_BROWSER_EVENTS = [
  "CompleteRegistration",
  "Lead",
  "Purchase",
  "Subscribe",
  "Schedule",
  "Contact",
  "InitiateCheckout",
  "ViewContent",
  "AddPaymentInfo",
  "PageView",
] as const;

export type MetaBrowserEventName = (typeof META_BROWSER_EVENTS)[number];

const ALLOWED = new Set<string>(META_BROWSER_EVENTS);

export function metaEventAllowed(eventName: string): boolean {
  return ALLOWED.has(eventName);
}

/**
 * Named pixel_ids win. Otherwise the event fans out to every pixel.
 * The kit Lead passes pixel 745 itself. Other Leads, including /onefeaturetraining-4,
 * stay on both pixels.
 */
export function defaultPixelIds(
  _eventName: string,
  requested: string[] | undefined,
  _leadPixelId: string,
): string[] | undefined {
  if (requested && requested.length) return requested;
  return undefined;
}

/** Digits only. A 10-digit US number gets country code 1 before hashing. */
export function metaPhoneDigits(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

/** True only when Origin or Referer is one of our sites. No host means a server caller. */
export function browserOriginAllowed(origin?: string | null, referer?: string | null): boolean {
  const originHost = hostOf(origin);
  if (originHost) return hostAllowed(originHost);
  const refererHost = hostOf(referer);
  if (refererHost) return hostAllowed(refererHost);
  return false;
}

export function clientIpFromForwarded(header: string | null | undefined): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 80) return null;
  return first;
}

/**
 * Service-role calls keep the IP they stored. A browser call on our own site
 * fills a missing IP from the request. GHL and other server callers do not.
 */
export function resolvedClientNetwork(input: {
  serviceRole: boolean;
  clientIp?: unknown;
  clientUserAgent?: unknown;
  forwardedFor?: string | null;
  userAgent?: string | null;
  origin?: string | null;
  referer?: string | null;
  ghlNormalized?: boolean;
}): { clientIp?: string; clientUserAgent?: string } {
  const ip = typeof input.clientIp === "string" && input.clientIp.trim()
    ? input.clientIp.trim().slice(0, 80)
    : undefined;
  const ua = typeof input.clientUserAgent === "string" && input.clientUserAgent.trim()
    ? input.clientUserAgent.trim().slice(0, 500)
    : undefined;
  const ownBrowser = !input.ghlNormalized && browserOriginAllowed(input.origin, input.referer);
  if (input.serviceRole || !ownBrowser) return { clientIp: ip, clientUserAgent: ua };
  const forwarded = clientIpFromForwarded(input.forwardedFor);
  const headerUa = input.userAgent?.trim().slice(0, 500);
  return {
    clientIp: ip || forwarded || undefined,
    clientUserAgent: ua || headerUa || undefined,
  };
}

export function secretEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length === 0 || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

export function isServiceRoleRequest(input: {
  authorization: string | null;
  apikey: string | null;
  serviceRoleKey: string;
}): boolean {
  const key = input.serviceRoleKey;
  if (!key) return false;
  const auth = input.authorization ?? "";
  const bearer = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, "").trim() : "";
  return secretEquals(bearer, key) || secretEquals(input.apikey ?? "", key);
}

export function purchaseStripeId(eventId: string): { kind: "checkout" | "payment_intent"; id: string } | null {
  if (!eventId.startsWith("order_")) return null;
  const id = eventId.slice("order_".length);
  if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return { kind: "checkout", id };
  if (/^pi_[A-Za-z0-9]+$/.test(id)) return { kind: "payment_intent", id };
  return null;
}

/** Checkout is paid only when Stripe says payment_status is paid. */
export function checkoutPaymentCollected(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid";
}

/**
 * A finished checkout that collected $0 because it started a subscription trial.
 * An open session, a comped one-time checkout, and a coupon with no trial are not this.
 */
export function isCheckoutTrial(input: {
  mode?: string | null;
  amountCents?: number | null;
  status?: string | null;
  paymentStatus?: string | null;
  trialSource?: string | null;
  subscriptionStatus?: string | null;
}): boolean {
  if (input.mode !== "subscription") return false;
  if (typeof input.amountCents === "number" && input.amountCents > 0) return false;
  const finished = input.status === "complete"
    || input.paymentStatus === "paid"
    || input.paymentStatus === "no_payment_required";
  if (!finished) return false;
  return Boolean(input.trialSource?.trim()) || input.subscriptionStatus === "trialing";
}

export type TrialPriceLine = {
  unitAmountCents: number | null;
  currency?: string | null;
  recurring: boolean;
  quantity?: number | null;
};

/**
 * Recurring plan price in cents. One-time add-ons are skipped.
 * The first recurring USD price wins, which is the subscription plan.
 */
export function trialPlanPriceCents(lines: TrialPriceLine[]): number | null {
  for (const line of lines) {
    if (!line.recurring) continue;
    if (line.currency && line.currency.toLowerCase() !== "usd") continue;
    if (typeof line.unitAmountCents !== "number" || line.unitAmountCents <= 0) continue;
    const quantity = typeof line.quantity === "number" && line.quantity > 0 ? line.quantity : 1;
    return Math.round(line.unitAmountCents * quantity);
  }
  return null;
}

/** The browser value must be the amount Stripe actually collected, in USD. */
export function stripeChargeMatches(input: {
  paid: boolean;
  currency: string | null;
  amountCents: number | null;
  value: number;
}): boolean {
  if (!input.paid) return false;
  if (!input.currency || input.currency.toLowerCase() !== "usd") return false;
  if (typeof input.amountCents !== "number" || input.amountCents <= 0) return false;
  if (!Number.isFinite(input.value) || input.value <= 0) return false;
  return Math.round(input.value * 100) === input.amountCents;
}

export function authorizePurchase(input: {
  serviceRole: boolean;
  eventId: string;
  value: number;
  stripe: {
    paid: boolean;
    currency: string | null;
    amountCents: number | null;
    email?: string | null;
    trial?: boolean;
    planPriceCents?: number | null;
  } | null;
}): { allow: true; value: number; email?: string } | { allow: false } {
  if (input.serviceRole) return { allow: true, value: input.value };
  if (!purchaseStripeId(input.eventId) || !input.stripe) return { allow: false };
  // -3/-4 trials collect $0. Send Stripe's recurring plan price, never the browser's number.
  if (input.stripe.trial) {
    const cents = input.stripe.planPriceCents;
    if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) return { allow: false };
    return {
      allow: true,
      value: cents / 100,
      email: input.stripe.email?.trim() || undefined,
    };
  }
  if (!stripeChargeMatches({ ...input.stripe, value: input.value })) return { allow: false };
  return {
    allow: true,
    value: input.stripe.amountCents! / 100,
    email: input.stripe.email?.trim() || undefined,
  };
}

export function metaCustomData(body: Record<string, unknown>, value: number, currency: string): Record<string, unknown> {
  const custom: Record<string, unknown> = { value, currency };
  if (Array.isArray(body.content_ids)) {
    const ids = body.content_ids
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map(id => id.trim().slice(0, 100))
      .slice(0, 20);
    if (ids.length) custom.content_ids = ids;
  }
  if (typeof body.content_type === "string" && body.content_type.trim()) {
    custom.content_type = body.content_type.trim().slice(0, 50);
  }
  if (typeof body.content_name === "string" && body.content_name.trim()) {
    custom.content_name = body.content_name.trim().slice(0, 200);
  }
  if (typeof body.order_id === "string" && body.order_id.trim()) {
    custom.order_id = body.order_id.trim().slice(0, 200);
  }
  const num = Number(body.num_items);
  if (Number.isFinite(num) && num > 0) custom.num_items = Math.min(Math.round(num), 100);
  if (Array.isArray(body.contents)) {
    const contents = body.contents.slice(0, 20).flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim().slice(0, 100) : "";
      if (!id) return [];
      const quantity = Number(row.quantity);
      const itemPrice = Number(row.item_price);
      const out: Record<string, unknown> = {
        id,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      };
      if (Number.isFinite(itemPrice) && itemPrice >= 0) out.item_price = itemPrice;
      return [out];
    });
    if (contents.length) custom.contents = contents;
  }
  return custom;
}
