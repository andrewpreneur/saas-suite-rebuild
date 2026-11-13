/**
 * One Feature Kit Meta event ids, charged amounts, and webhook idempotency.
 * Pure: no Deno, no network. Browser and edge functions share these rules.
 *
 * event ids:
 *   PageView            pv_<uuid>
 *   ViewContent         vc_<uuid>          (same uuid as that step's PageView)
 *   Lead                lead_ofk_<capability hash, first 16 hex>
 *   InitiateCheckout    ic_<checkout session id>
 *   Purchase checkout   order_<checkout session id>
 *   Purchase upsell     order_<payment intent id>
 */

export const KIT_FUNNEL_META = "one-feature-kit";
export const META_LEAD_PIXEL_ID = "745177780828109";

export const KIT_TRACKING_META_KEYS = [
  "fbp",
  "fbc",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "landing_page",
  "referrer",
  "page_url",
  "checkout_page",
  "client_ip",
  "client_ua",
  "tracking_optout",
  "is_test",
] as const;

export type KitTrackingInput = {
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  landing_page?: string;
  referrer?: string;
  page_url?: string;
  checkout_page?: string;
  lead_event_id?: string;
  tracking_optout?: boolean;
  is_test?: boolean;
};

export type KitMetaLine = { id: string; amountCents: number; name?: string };

export type KitMetaContent = { id: string; quantity: 1; item_price: number };

export type KitMetaPurchase = {
  eventId: string;
  orderId: string;
  value: number;
  currency: "USD";
  contentIds: string[];
  contents: KitMetaContent[];
  contentName: string;
  contentType: "product";
  numItems: number;
};

export function isOneFeatureKitFunnel(metadata: { funnel?: string | null } | null | undefined): boolean {
  return metadata?.funnel === KIT_FUNNEL_META;
}

export function kitPageViewEventId(uuid: string): string {
  return `pv_${uuid}`;
}

export function kitViewContentEventId(uuid: string): string {
  return `vc_${uuid}`;
}

/** First 16 hex chars of the checkout capability hash. Stable for that browser. */
export function kitLeadEventId(capabilityHash: string): string {
  return `lead_ofk_${capabilityHash.slice(0, 16)}`;
}

export function kitInitiateCheckoutEventId(sessionId: string): string {
  return `ic_${sessionId}`;
}

export function kitPurchaseEventId(orderId: string): string {
  return `order_${orderId}`;
}

export function kitMetaActionKey(orderId: string): string {
  return `meta:${orderId}`;
}

/** Dollars from Stripe cents. 37000 → 370. */
export function chargedUsd(cents: number): number {
  return Math.round(cents) / 100;
}

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/** fb.1.<click time ms>.<fbclid>. The same string is stored on the session and sent as CAPI fbc. */
export function kitFbcFromClick(fbclid: string, nowMs: number): string {
  const id = fbclid.trim();
  if (!id) return "";
  const ts = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
  if (ts <= 0) return "";
  return `fb.1.${ts}.${id}`.slice(0, 500);
}

/** Contact fields GoHighLevel maps onto the kit buyer. Always present, never null. */
export const KIT_CONTACT_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export type KitContactUtms = Record<(typeof KIT_CONTACT_UTM_KEYS)[number], string>;

export function kitUtmFields(input?: { [key: string]: unknown } | null): KitContactUtms {
  const source = input ?? {};
  const text = (key: (typeof KIT_CONTACT_UTM_KEYS)[number]) => {
    const value = source[key];
    return typeof value === "string" ? value.trim().slice(0, 200) : "";
  };
  return {
    utm_source: text("utm_source"),
    utm_medium: text("utm_medium"),
    utm_campaign: text("utm_campaign"),
    utm_content: text("utm_content"),
  };
}

/** Non-empty UTMs only. Stripe rejects an empty metadata value. */
export function kitUtmMetadata(fields: KitContactUtms): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const key of KIT_CONTACT_UTM_KEYS) {
    if (fields[key]) meta[key] = fields[key];
  }
  return meta;
}

/** Stripe metadata values are strings, 500 characters max. Ad ids are omitted after opt-out. */
export function kitStripeTrackingMetadata(input: {
  tracking?: KitTrackingInput | null;
  clientIp?: string | null;
  clientUa?: string | null;
  /** Used only when the client sent fbclid and no fbc. Defaults to Date.now. */
  nowMs?: number;
}): Record<string, string> {
  const tracking = input.tracking ?? {};
  const optedOut = tracking.tracking_optout === true;
  const meta: Record<string, string> = { tracking_optout: optedOut ? "true" : "false" };
  if (tracking.is_test === true) meta.is_test = "true";
  if (optedOut) return meta;
  const fbclid = clip(tracking.fbclid, 500);
  const fbc = clip(tracking.fbc, 500) || (fbclid ? kitFbcFromClick(fbclid, input.nowMs ?? Date.now()) : "");
  const entries: Record<string, string | undefined> = {
    fbp: clip(tracking.fbp, 200),
    fbc: fbc || undefined,
    fbclid,
    utm_source: clip(tracking.utm_source, 200),
    utm_medium: clip(tracking.utm_medium, 200),
    utm_campaign: clip(tracking.utm_campaign, 200),
    utm_content: clip(tracking.utm_content, 200),
    utm_term: clip(tracking.utm_term, 200),
    utm_id: clip(tracking.utm_id, 200),
    landing_page: clip(tracking.landing_page, 500),
    referrer: clip(tracking.referrer, 500),
    page_url: clip(tracking.page_url, 500),
    checkout_page: clip(tracking.checkout_page, 500),
    client_ip: clip(input.clientIp, 80),
    client_ua: clip(input.clientUa, 500),
  };
  for (const [key, value] of Object.entries(entries)) {
    if (value) meta[key] = value;
  }
  return meta;
}

export function pickKitEventMetadata(metadata: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!metadata) return out;
  const keys = [...KIT_TRACKING_META_KEYS, "name", "email", "phone", "ofk_session_id"] as const;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 500);
  }
  return out;
}

/** Purchase user_data uses these fbc and fbp strings unchanged. Do not rebuild fbc here. */
export function kitMetaUserData(metadata: Record<string, string> | null | undefined) {
  const md = metadata ?? {};
  return {
    email: md.email?.trim() || null,
    phone: md.phone?.trim() || null,
    firstName: md.name?.trim() || null,
    fbp: md.fbp?.trim() || null,
    fbc: md.fbc?.trim() || null,
    fbclid: md.fbclid?.trim() || null,
    pageUrl: md.page_url?.trim() || null,
    clientIp: md.client_ip?.trim() || null,
    clientUa: md.client_ua?.trim() || null,
    utmSource: md.utm_source?.trim() || null,
    testEventCode: md.test_event_code?.trim() || null,
    trackingOptout: md.tracking_optout === "true",
    isTest: md.is_test === "true" || md.is_test === "1",
  };
}

function contentsFor(lines: KitMetaLine[]): KitMetaContent[] {
  return lines.filter(line => line.id).map(line => ({
    id: line.id,
    quantity: 1 as const,
    item_price: chargedUsd(line.amountCents),
  }));
}

/**
 * Checkout Purchase. Value is Stripe amount_total, which already includes bumps
 * and any promotion. $0, comped, and opt-out orders return null (no event).
 */
export function kitCheckoutMetaPurchase(input: {
  sessionId: string;
  amountTotalCents: number | null;
  comped: boolean;
  trackingOptout: boolean;
  lines: KitMetaLine[];
}): KitMetaPurchase | null {
  if (input.trackingOptout || input.comped) return null;
  if (!input.sessionId.startsWith("cs_")) return null;
  if (typeof input.amountTotalCents !== "number" || input.amountTotalCents <= 0) return null;
  const lines = input.lines.filter(line => line.id);
  return {
    eventId: kitPurchaseEventId(input.sessionId),
    orderId: input.sessionId,
    value: chargedUsd(input.amountTotalCents),
    currency: "USD",
    contentIds: lines.map(line => line.id),
    contents: contentsFor(lines),
    contentName: lines[0]?.name || "The GoHighLevel One Feature Kit",
    contentType: "product",
    numItems: lines.length,
  };
}

/**
 * One-click upsell or a future downsell. Value is PaymentIntent amount_received.
 * A comped add-on has no PaymentIntent, and a $0 intent is skipped.
 */
export function kitUpsellMetaPurchase(input: {
  paymentIntentId: string;
  amountReceivedCents: number | null;
  offerId: string;
  contentName?: string;
  itemAmountCents?: number;
  trackingOptout: boolean;
}): KitMetaPurchase | null {
  if (input.trackingOptout) return null;
  if (!input.paymentIntentId.startsWith("pi_") || !input.offerId) return null;
  if (typeof input.amountReceivedCents !== "number" || input.amountReceivedCents <= 0) return null;
  const itemCents = typeof input.itemAmountCents === "number" ? input.itemAmountCents : input.amountReceivedCents;
  return {
    eventId: kitPurchaseEventId(input.paymentIntentId),
    orderId: input.paymentIntentId,
    value: chargedUsd(input.amountReceivedCents),
    currency: "USD",
    contentIds: [input.offerId],
    contents: [{ id: input.offerId, quantity: 1, item_price: chargedUsd(itemCents) }],
    contentName: input.contentName || input.offerId,
    contentType: "product",
    numItems: 1,
  };
}

/** Checkout PaymentIntents have no offer_id. Purchase for those comes from the session. */
export function kitPaymentIntentKind(metadata: { funnel?: string | null; offer_id?: string | null } | null | undefined): "checkout" | "upsell" | "ignore" {
  if (!isOneFeatureKitFunnel(metadata)) return "ignore";
  if (!metadata?.offer_id) return "checkout";
  return "upsell";
}

/** Upsell Purchase event_source_url. The live page wins; otherwise the step's own URL. */
export function kitUpsellEventSource(offerId: string, pageUrl?: string | null): string {
  const canonical = offerId === "launch"
    ? "https://saassuite.ai/one-feature-kit/launch-pack"
    : offerId === "webinar-system"
      ? "https://saassuite.ai/one-feature-kit/webinar-sales-system"
      : "https://saassuite.ai/one-feature-kit";
  const trimmed = pageUrl?.trim() ?? "";
  if (!trimmed) return canonical;
  try {
    const host = new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "");
    const ownSite = host === "saassuite.ai" || host.endsWith(".saassuite.ai")
      || host === "gofreesaas.com" || host.endsWith(".gofreesaas.com");
    if (ownSite) return trimmed.slice(0, 500);
  } catch {
    /* A bad URL falls back to the step path. */
  }
  return canonical;
}

/**
 * claim_one_feature_kit_action returns true for the worker that owns the key.
 * A completed prior claim is a Stripe retry and must not send a second Purchase.
 * An open lease means another worker is in flight. Log it and move on. Do not
 * fail the webhook: Stripe would rerun entitlements, email, Slack, and Lynkific.
 */
export function kitMetaClaimDecision(claimed: boolean, alreadyCompleted: boolean): "send" | "skip" | "retry" {
  if (alreadyCompleted) return "skip";
  if (claimed) return "send";
  return "retry";
}

export async function runMetaPurchaseDelivery(input: {
  claimed: boolean;
  completed: boolean;
  purchase: KitMetaPurchase | null;
  send: () => Promise<boolean>;
  release: () => Promise<void>;
  complete: () => Promise<void>;
}): Promise<"sent" | "skipped" | "duplicate" | "failed" | "busy"> {
  try {
    if (!input.purchase) return "skipped";
    const decision = kitMetaClaimDecision(input.claimed, input.completed);
    if (decision === "skip") return "duplicate";
    if (decision === "retry") return "busy";
    let ok = false;
    try {
      ok = await input.send();
    } catch {
      ok = false;
    }
    if (!ok) {
      try { await input.release(); } catch { /* The lease expires and a later delivery can send. */ }
      return "failed";
    }
    await input.complete();
    return "sent";
  } catch {
    // Leave the lease in place when completion itself fails, so a second
    // delivery cannot send the same Purchase while this one may have landed.
    return "failed";
  }
}
