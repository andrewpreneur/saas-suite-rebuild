import { metaPhoneDigits } from "./meta-capi-policy.ts";

/**
 * Browser page_view and view_item already hit this Stape server container as
 * GA4 collect query strings. A JSON body with cid only is a 400 on /g/collect.
 * Measurement Protocol (/mp/collect) is the other path that standard GA4 client accepts.
 */
export const STAPE_GA4_COLLECT_URL = "https://xyaheorc.usw.stape.io/g/collect";
export const STAPE_GA4_MEASUREMENT_ID = "G-UEFEWR349R8";

/** HTTPS Stape endpoint. Unset means the kit Purchase still uses direct Meta. */
export function stapePurchaseUrl(value: string | undefined | null): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function stapeMeasurementId(value: string | undefined | null): string {
  const id = value?.trim() || STAPE_GA4_MEASUREMENT_ID;
  return /^G-[A-Z0-9]+$/i.test(id) ? id : STAPE_GA4_MEASUREMENT_ID;
}

/** Same trim-and-lowercase SHA-256 meta-capi sends as em and ph. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable GA4 client id for one order. The browser _ga cookie is not on the webhook. */
export function stapeClientId(orderId: string): string {
  let hi = 2166136261;
  let lo = 2166136261;
  for (let i = 0; i < orderId.length; i++) {
    hi = Math.imul(hi ^ orderId.charCodeAt(i), 16777619);
    lo = Math.imul(lo ^ orderId.charCodeAt(orderId.length - 1 - i), 16777619);
  }
  const a = (hi >>> 0) % 2147483647 || 1;
  const b = (lo >>> 0) % 2147483647 || 1;
  return `${a}.${b}`;
}

export type StapePurchaseInput = {
  eventId: string;
  eventTimeSec: number;
  value: number;
  currency: string;
  orderId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  eventSourceUrl?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  externalId?: string | null;
  contentIds?: string[] | null;
  contents?: { id: string; quantity?: number; item_price?: number }[] | null;
  contentType?: string | null;
  contentName?: string | null;
  numItems?: number | null;
  testEventCode?: string | null;
};

export type StapePurchaseHit = {
  protocol: "ga4-collect" | "ga4-mp";
  url: string;
  body: string;
  headers: Record<string, string>;
};

function measurementProtocol(endpoint: string): boolean {
  try {
    return new URL(endpoint).pathname.replace(/\/+$/, "").endsWith("/mp/collect");
  } catch {
    return false;
  }
}

/**
 * /g/collect uses the query string this container already accepts.
 * /mp/collect uses GA4 Measurement Protocol JSON, which needs STAPE_API_SECRET
 * on a client that validates it.
 */
export async function buildStapePurchaseRequest(input: StapePurchaseInput & {
  endpoint: string;
  measurementId?: string | null;
  apiSecret?: string | null;
}): Promise<StapePurchaseHit> {
  const measurementId = stapeMeasurementId(input.measurementId);
  const currency = (input.currency || "USD").toUpperCase();
  const email = input.email?.trim().toLowerCase();
  const emailHash = email?.includes("@") ? await sha256Hex(email) : "";
  const digits = input.phone ? metaPhoneDigits(input.phone) : "";
  const phoneHash = digits ? await sha256Hex(digits) : "";
  const first = input.firstName?.trim() || "";
  const firstHash = first ? await sha256Hex(first) : "";
  const external = input.externalId?.trim() || "";
  const externalHash = external ? await sha256Hex(external) : "";

  if (measurementProtocol(input.endpoint)) {
    const url = new URL(input.endpoint);
    url.searchParams.set("measurement_id", measurementId);
    const secret = input.apiSecret?.trim();
    if (secret) url.searchParams.set("api_secret", secret);
    const params: Record<string, unknown> = {
      event_id: input.eventId,
      event_name: "Purchase",
      transaction_id: input.orderId,
      value: input.value,
      currency,
      engagement_time_msec: 1,
      items: (input.contents ?? []).map((item) => ({
        item_id: item.id,
        price: item.item_price,
        quantity: item.quantity ?? 1,
      })),
    };
    if (input.contentIds?.length) params.content_ids = input.contentIds.join(",");
    if (input.contentName) params.content_name = input.contentName;
    if (input.numItems != null) params.num_items = input.numItems;
    if (input.fbp?.trim()) params.fbp = input.fbp.trim();
    if (input.fbc?.trim()) params.fbc = input.fbc.trim();
    if (input.fbclid?.trim()) params.fbclid = input.fbclid.trim();
    if (emailHash) params.sha256_email_address = emailHash;
    if (phoneHash) params.sha256_phone_number = phoneHash;
    if (input.eventSourceUrl) params.page_location = input.eventSourceUrl;
    const code = input.testEventCode?.trim();
    if (code) params.test_event_code = code;
    const userData: Record<string, string | string[]> = {};
    if (emailHash) userData.sha256_email_address = emailHash;
    if (phoneHash) userData.sha256_phone_number = phoneHash;
    const body: Record<string, unknown> = {
      client_id: stapeClientId(input.orderId),
      timestamp_micros: input.eventTimeSec * 1_000_000,
      events: [{ name: "purchase", params }],
    };
    if (Object.keys(userData).length) body.user_data = userData;
    if (input.clientIp) body.ip_override = input.clientIp;
    if (input.clientUserAgent) body.user_agent = input.clientUserAgent;
    return {
      protocol: "ga4-mp",
      url: url.toString(),
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    };
  }

  const url = new URL(input.endpoint);
  url.searchParams.set("v", "2");
  url.searchParams.set("tid", measurementId);
  url.searchParams.set("cid", stapeClientId(input.orderId));
  url.searchParams.set("en", "purchase");
  url.searchParams.set("ep.event_id", input.eventId);
  url.searchParams.set("ep.event_name", "Purchase");
  url.searchParams.set("ep.transaction_id", input.orderId);
  url.searchParams.set("epn.value", String(input.value));
  url.searchParams.set("ep.currency", currency);
  url.searchParams.set("epn.engagement_time_msec", "1");
  if (input.eventSourceUrl) url.searchParams.set("dl", input.eventSourceUrl);
  if (input.numItems != null) url.searchParams.set("epn.num_items", String(input.numItems));
  if (input.contentIds?.length) url.searchParams.set("ep.content_ids", input.contentIds.join(","));
  if (input.contentType) url.searchParams.set("ep.content_type", input.contentType);
  if (input.contentName) url.searchParams.set("ep.content_name", input.contentName);
  if (input.fbp?.trim()) url.searchParams.set("ep.x-fb-ck-fbp", input.fbp.trim());
  if (input.fbc?.trim()) url.searchParams.set("ep.x-fb-ck-fbc", input.fbc.trim());
  if (input.fbclid?.trim()) url.searchParams.set("ep.fbclid", input.fbclid.trim());
  if (emailHash) url.searchParams.set("ep.sha256_email_address", emailHash);
  if (phoneHash) url.searchParams.set("ep.sha256_phone_number", phoneHash);
  if (firstHash) url.searchParams.set("ep.sha256_first_name", firstHash);
  if (externalHash) url.searchParams.set("ep.sha256_external_id", externalHash);
  const code = input.testEventCode?.trim();
  if (code) url.searchParams.set("ep.test_event_code", code);
  (input.contents ?? []).forEach((item, index) => {
    const parts = [`id${item.id}`];
    if (item.item_price != null) parts.push(`pr${item.item_price}`);
    parts.push(`qt${item.quantity ?? 1}`);
    url.searchParams.set(`pr${index + 1}`, parts.join("~"));
  });
  return {
    protocol: "ga4-collect",
    url: url.toString(),
    body: "",
    headers: {},
  };
}

/**
 * GA4 Stape when STAPE_PURCHASE_URL is set. Direct Meta only when it is unset.
 * STAPE_SERVER_URL is a separate Data Client path and is chosen by the caller
 * before this function runs. A Stape failure does not also call Meta.
 */
export async function sendKitServerPurchase(input: {
  stapeUrl: string | null;
  stapeToken?: string | null;
  body: string | Record<string, unknown>;
  headers?: Record<string, string>;
  post: (url: string, body: string, headers: Record<string, string>) => Promise<{ ok: boolean }>;
  sendMeta: () => Promise<boolean>;
}): Promise<{ via: "stape" | "meta"; ok: boolean }> {
  if (input.stapeUrl) {
    const headers: Record<string, string> = { ...(input.headers ?? {}) };
    const token = input.stapeToken?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    const raw = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
    try {
      const result = await input.post(input.stapeUrl, raw, headers);
      return { via: "stape", ok: result.ok === true };
    } catch {
      return { via: "stape", ok: false };
    }
  }
  try {
    return { via: "meta", ok: await input.sendMeta() };
  } catch {
    return { via: "meta", ok: false };
  }
}

/** One server Purchase. Stape and Meta are exclusive. */
export async function postKitServerPurchase(input: {
  stapeUrl: string | null;
  measurementId?: string | null;
  apiSecret?: string | null;
  stapeToken?: string | null;
  purchase: StapePurchaseInput;
  post: (url: string, body: string, headers: Record<string, string>) => Promise<{ ok: boolean }>;
  sendMeta: () => Promise<boolean>;
}): Promise<{ via: "stape" | "meta"; ok: boolean }> {
  if (!input.stapeUrl) {
    return sendKitServerPurchase({
      stapeUrl: null,
      body: "",
      post: input.post,
      sendMeta: input.sendMeta,
    });
  }
  const hit = await buildStapePurchaseRequest({
    endpoint: input.stapeUrl,
    measurementId: input.measurementId,
    apiSecret: input.apiSecret,
    ...input.purchase,
  });
  return sendKitServerPurchase({
    stapeUrl: hit.url,
    stapeToken: input.stapeToken,
    body: hit.body,
    headers: hit.headers,
    post: input.post,
    sendMeta: input.sendMeta,
  });
}
