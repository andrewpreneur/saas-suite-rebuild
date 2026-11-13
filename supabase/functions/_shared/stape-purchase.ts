import { metaPhoneDigits } from "./meta-capi-policy.ts";
import { metaSendPlan, metaTestEventCode } from "./test-traffic.ts";
import { sha256Hex } from "./kit-stape.ts";

/**
 * One Purchase POST for the Stape server GTM Data Client.
 * The container fans the same event_id out to one Facebook CAPI tag per pixel.
 * STAPE_SERVER_URL unset means the caller keeps today's direct Meta path.
 */

export const STAPE_PIXEL_IDS = ["745177780828109", "1601372838188959"] as const;
export const DEFAULT_STAPE_PURCHASE_PATH = "/data";
export const DEFAULT_STAPE_EVENT_NAME = "Purchase";

export type StapePost = (
  url: string,
  body: string,
  headers: Record<string, string>,
) => Promise<{ ok: boolean }>;

export type StapeDataPurchaseInput = {
  eventId: string;
  /** Unix seconds. Milliseconds are converted. */
  eventTimeSec: number;
  value: number;
  currency?: string | null;
  orderId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  eventSourceUrl?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  externalId?: string | null;
  contentIds?: string[] | null;
  contentName?: string | null;
  numItems?: number | null;
  eventName?: string | null;
  testEventCode?: string | null;
};

export type PurchaseRoute =
  | { route: "direct" }
  | { route: "skip"; reason: "test_traffic" }
  | { route: "stape"; endpoint: string; eventName: string; testEventCode?: string };

type ActionRead = {
  data: { completed?: boolean } | null;
  error: { message?: string } | null;
};

type ActionWrite = { error: { message?: string } | null };

/** Same shape as the service-role client calls against one_feature_kit_actions. */
export type PurchaseActionDb = {
  rpc: (
    fn: "claim_one_feature_kit_action",
    args: { p_key: string },
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from: (table: "one_feature_kit_actions") => {
    select: (cols: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<ActionRead>;
      };
    };
    update: (row: { completed?: boolean; lease_until?: string }) => {
      eq: (column: string, value: string) => PromiseLike<ActionWrite>;
    };
  };
};

export function appPurchaseClaimKey(orderId: string): string {
  return `purchase:${orderId}`;
}

/** Browser and server Purchase eventID for a Stripe Checkout Session or PaymentIntent. */
export function purchaseEventId(orderId: string): string {
  return `order_${orderId}`;
}

export function utmIsQaTest(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "qa_test";
}

export function stapePurchasePath(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return DEFAULT_STAPE_PURCHASE_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("?") || raw.includes("#") || raw.includes("..")) {
    return DEFAULT_STAPE_PURCHASE_PATH;
  }
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || DEFAULT_STAPE_PURCHASE_PATH;
}

export function stapeEventName(value: string | null | undefined): string {
  const name = (value ?? "").trim();
  if (!name) return DEFAULT_STAPE_EVENT_NAME;
  if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) return DEFAULT_STAPE_EVENT_NAME;
  return name;
}

/** Base origin plus the purchase path. An empty or non-HTTPS base means "not configured". */
export function stapeDataEndpoint(base: string | null | undefined, path: string | null | undefined): string | null {
  const raw = (base ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    url.pathname = stapePurchasePath(path);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveStapeTestEventCode(
  explicit: string | null | undefined,
  envCode: string | null | undefined,
): string | null {
  const passed = (explicit ?? "").trim();
  if (passed) return passed.slice(0, 80);
  const env = (envCode ?? "").trim();
  return env ? env.slice(0, 80) : null;
}

export function unixEventTime(value: number): number {
  if (!Number.isFinite(value)) return Math.floor(Date.now() / 1000);
  const whole = Math.trunc(value);
  if (whole > 10_000_000_000) return Math.trunc(whole / 1000);
  if (whole < 0) return Math.floor(Date.now() / 1000);
  return whole;
}

export function purchaseSourceUrl(pathOrUrl?: string | null): string {
  const raw = (pathOrUrl ?? "").trim();
  if (!raw) return "https://saassuite.ai";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://saassuite.ai${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export function splitPersonName(full: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

/**
 * Where this order's server Purchase goes.
 * No STAPE_SERVER_URL: direct (today's Meta or GA4 Stape path) or the existing test skip.
 * With STAPE_SERVER_URL: one JSON post, or a skip when a test order has no test_event_code.
 * qa_test is a test only on the Stape route, so an unset URL does not change who is sent.
 */
export function purchaseRoutePlan(input: {
  serverUrl?: string | null;
  purchasePath?: string | null;
  eventName?: string | null;
  isTest: boolean;
  utmSource?: string | null;
  explicitTestEventCode?: string | null;
  stapeTestEventCode?: string | null;
  metaTestEventCode?: string | null;
}): PurchaseRoute {
  const endpoint = stapeDataEndpoint(input.serverUrl, input.purchasePath);
  const metaPlan = metaSendPlan(input.isTest, metaTestEventCode(input.metaTestEventCode));
  if (!endpoint) {
    if (input.isTest && !metaPlan.send) return { route: "skip", reason: "test_traffic" };
    return { route: "direct" };
  }
  const flagged = input.isTest || utmIsQaTest(input.utmSource);
  if (flagged) {
    const code = resolveStapeTestEventCode(input.explicitTestEventCode, input.stapeTestEventCode);
    if (!code) return { route: "skip", reason: "test_traffic" };
    return {
      route: "stape",
      endpoint,
      eventName: stapeEventName(input.eventName),
      testEventCode: code,
    };
  }
  return { route: "stape", endpoint, eventName: stapeEventName(input.eventName) };
}

function personNames(firstName?: string | null, lastName?: string | null): { first: string | null; last: string | null } {
  const last = (lastName ?? "").trim();
  const firstRaw = (firstName ?? "").trim();
  if (!last && /\s/.test(firstRaw)) {
    const parts = firstRaw.split(/\s+/).filter(Boolean);
    return { first: parts[0] ?? null, last: parts.slice(1).join(" ") || null };
  }
  return { first: firstRaw || null, last: last || null };
}

function clickId(fbc?: string | null, fbclid?: string | null, eventTimeSec?: number): string | null {
  const explicit = (fbc ?? "").trim();
  if (explicit) return explicit;
  const click = (fbclid ?? "").trim();
  if (!click) return null;
  if (click.startsWith("fb.1.")) return click;
  const seconds = unixEventTime(eventTimeSec ?? Date.now() / 1000);
  return `fb.1.${seconds * 1000}.${click}`;
}

function assignPresent(target: Record<string, unknown>, key: string, value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (Number.isFinite(value)) target[key] = value;
    return;
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (text) target[key] = text;
}

export async function buildStapeDataPurchase(input: StapeDataPurchaseInput): Promise<Record<string, unknown>> {
  const userData: Record<string, unknown> = {};
  const email = input.email?.trim().toLowerCase() ?? "";
  const emailHash = email.includes("@") ? await sha256Hex(email) : "";
  if (emailHash) userData.em = [emailHash];
  const names = personNames(input.firstName, input.lastName);
  const firstHash = names.first ? await sha256Hex(names.first) : "";
  const lastHash = names.last ? await sha256Hex(names.last) : "";
  if (firstHash) userData.fn = [firstHash];
  if (lastHash) userData.ln = [lastHash];
  const digits = input.phone ? metaPhoneDigits(input.phone) : "";
  const phoneHash = digits ? await sha256Hex(digits) : "";
  if (phoneHash) userData.ph = [phoneHash];
  const external = input.externalId?.trim() ?? "";
  const externalHash = external ? await sha256Hex(external) : "";
  if (externalHash) userData.external_id = [externalHash];
  const fbp = input.fbp?.trim() ?? "";
  if (fbp) userData.fbp = fbp;
  const fbc = clickId(input.fbc, input.fbclid, input.eventTimeSec) ?? "";
  if (fbc) userData.fbc = fbc;
  const ip = input.clientIp?.trim() ?? "";
  if (ip) userData.client_ip_address = ip;
  const ua = input.clientUserAgent?.trim() ?? "";
  if (ua) userData.client_user_agent = ua;

  const contentIds = (input.contentIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20);
  const currency = ((input.currency || "USD").trim() || "USD").toUpperCase();
  const customData: Record<string, unknown> = {
    value: input.value,
    currency,
    order_id: input.orderId,
  };
  if (contentIds.length) customData.content_ids = contentIds;
  const contentName = input.contentName?.trim() ?? "";
  if (contentName) customData.content_name = contentName.slice(0, 200);
  if (typeof input.numItems === "number" && Number.isFinite(input.numItems) && input.numItems > 0) {
    customData.num_items = Math.min(Math.round(input.numItems), 100);
  }

  const sourceUrl = purchaseSourceUrl(input.eventSourceUrl);
  const body: Record<string, unknown> = {
    event_name: stapeEventName(input.eventName),
    event_id: input.eventId,
    event_time: unixEventTime(input.eventTimeSec),
    action_source: "website",
    event_source_url: sourceUrl,
    user_data: userData,
    custom_data: customData,
    pixel_ids: [...STAPE_PIXEL_IDS],
  };
  // Stape's FB CAPI tag in inherit-from-client mode reads these flat keys.
  // The nested user_data block above stays for a tag that maps Meta's shape.
  // Hashes are the same hex as the one-element arrays, sent here as strings.
  assignPresent(body, "x-fb-ud-em", emailHash);
  assignPresent(body, "x-fb-ud-ph", phoneHash);
  assignPresent(body, "x-fb-ud-fn", firstHash);
  assignPresent(body, "x-fb-ud-ln", lastHash);
  assignPresent(body, "x-fb-ud-external_id", externalHash);
  assignPresent(body, "x-fb-ck-fbp", fbp);
  assignPresent(body, "x-fb-ck-fbc", fbc);
  assignPresent(body, "ip_override", ip);
  assignPresent(body, "user_agent", ua);
  assignPresent(body, "page_location", sourceUrl);
  assignPresent(body, "value", input.value);
  assignPresent(body, "currency", currency);
  assignPresent(body, "transaction_id", input.orderId);
  const code = input.testEventCode?.trim() ?? "";
  if (code) body.test_event_code = code.slice(0, 80);
  return body;
}

export async function postStapeDataPurchase(input: {
  endpoint: string;
  eventName?: string | null;
  testEventCode?: string | null;
  purchase: StapeDataPurchaseInput;
  post: StapePost;
}): Promise<{ ok: boolean }> {
  const body = await buildStapeDataPurchase({
    ...input.purchase,
    eventName: input.eventName ?? input.purchase.eventName,
    testEventCode: input.testEventCode ?? input.purchase.testEventCode,
  });
  const result = await input.post(input.endpoint, JSON.stringify(body), { "Content-Type": "application/json" });
  return { ok: result.ok === true };
}

/**
 * Stape JSON when the plan says so. Direct when it does not.
 * sendDirect is not called on the Stape path, so Meta is not also posted.
 */
export async function routeServerPurchase(input: {
  plan: PurchaseRoute;
  orderId: string;
  purchase: StapeDataPurchaseInput;
  post: StapePost;
  sendDirect: () => Promise<boolean>;
}): Promise<{ via: "stape" | "direct" | "skip"; ok: boolean }> {
  if (input.plan.route === "skip") {
    console.log("purchase route skipped test", input.orderId);
    return { via: "skip", ok: true };
  }
  if (input.plan.route === "direct") {
    console.log("purchase route direct", input.orderId);
    try {
      return { via: "direct", ok: await input.sendDirect() };
    } catch {
      return { via: "direct", ok: false };
    }
  }
  console.log("purchase route stape", input.orderId, input.plan.testEventCode ? "test" : "live");
  try {
    const result = await postStapeDataPurchase({
      endpoint: input.plan.endpoint,
      eventName: input.plan.eventName,
      testEventCode: input.plan.testEventCode,
      purchase: input.purchase,
      post: input.post,
    });
    if (!result.ok) console.error("purchase route stape failed", input.orderId);
    return { via: "stape", ok: result.ok };
  } catch {
    console.error("purchase route stape failed", input.orderId);
    return { via: "stape", ok: false };
  }
}

export async function claimPurchaseAction(
  db: PurchaseActionDb,
  key: string,
): Promise<"send" | "skip" | "busy" | "error"> {
  try {
    const { data, error } = await db.rpc("claim_one_feature_kit_action", { p_key: key });
    if (error) return "error";
    if (data === true) return "send";
    const prior = await db.from("one_feature_kit_actions").select("completed").eq("action_key", key).maybeSingle();
    if (prior.error) return "error";
    if (prior.data?.completed === true) return "skip";
    return "busy";
  } catch {
    return "error";
  }
}

/** One Stape Purchase for an order. A completed claim does not post again. */
export async function deliverClaimedStapePurchase(input: {
  plan: Extract<PurchaseRoute, { route: "stape" }>;
  purchase: StapeDataPurchaseInput;
  orderId: string;
  post: StapePost;
  db: PurchaseActionDb;
  claimKey: string;
}): Promise<{ ok: boolean; skipped?: "duplicate" | "busy" | "claim" }> {
  const decision = await claimPurchaseAction(input.db, input.claimKey);
  if (decision === "error") {
    console.error("purchase route stape claim failed", input.orderId);
    return { ok: false, skipped: "claim" };
  }
  if (decision === "skip") {
    console.log("purchase route stape duplicate", input.orderId);
    return { ok: true, skipped: "duplicate" };
  }
  if (decision === "busy") {
    console.log("purchase route stape busy", input.orderId);
    return { ok: false, skipped: "busy" };
  }
  const result = await routeServerPurchase({
    plan: input.plan,
    orderId: input.orderId,
    purchase: input.purchase,
    post: input.post,
    sendDirect: async () => false,
  });
  if (!result.ok) {
    try {
      await input.db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", input.claimKey);
    } catch {
      /* The lease expires and a later delivery can send. */
    }
    return { ok: false };
  }
  try {
    const done = await input.db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", input.claimKey);
    if (done.error) console.error("purchase route stape complete failed", input.orderId);
  } catch {
    console.error("purchase route stape complete failed", input.orderId);
  }
  return { ok: true };
}

export function stapePurchaseFromKit(
  purchase: {
    eventId: string;
    orderId: string;
    value: number;
    currency: string;
    contentIds: string[];
    contentName?: string;
    numItems?: number;
  },
  user: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    fbclid?: string | null;
    pageUrl?: string | null;
    clientIp?: string | null;
    clientUa?: string | null;
  },
  externalId: string | null,
  eventTimeSec: number,
): StapeDataPurchaseInput {
  return {
    eventId: purchase.eventId,
    eventTimeSec,
    value: purchase.value,
    currency: purchase.currency,
    orderId: purchase.orderId,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    fbp: user.fbp,
    fbc: user.fbc,
    fbclid: user.fbclid,
    eventSourceUrl: user.pageUrl,
    clientIp: user.clientIp,
    clientUserAgent: user.clientUa,
    externalId,
    contentIds: purchase.contentIds,
    contentName: purchase.contentName,
    numItems: purchase.numItems,
  };
}
