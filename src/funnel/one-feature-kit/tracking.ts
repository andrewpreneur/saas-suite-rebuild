/**
 * Browser Meta pixel copies for the One Feature Kit funnel.
 * Server Purchases are sent by one-feature-kit-webhook. This file only fires
 * the pixel with the same event id so Meta can dedupe. PageView and ViewContent
 * also post a server copy through meta-capi.
 */
import { SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { captureKitAttribution, KIT_UTM_FIRST_TOUCH_KEY } from "./attribution";
import { pixelAllowedHere } from "@/utils/pixelHost";
import { isTestTraffic } from "@/utils/testTraffic";
import { hasOptedOutOfTracking, trackingPixelsAllowed } from "@/utils/trackingConsent";
import {
  META_LEAD_PIXEL_ID,
  chargedUsd,
  kitInitiateCheckoutEventId,
  kitPageViewEventId,
  kitPurchaseEventId,
  kitUtmFields,
  kitViewContentEventId,
  type KitContactUtms,
} from "../../../supabase/functions/_shared/kit-meta";
import { kitStepForPath } from "./steps";
import { claimKitPageView } from "./session";
import { buildStapeCollectUrl } from "./stapeCollect";
import { FUNNEL_ROUTES, checkoutLines, loadDraft, type KitBumps, type OrderLine } from "./order";

type Fbq = (command: string, ...args: unknown[]) => void;

type PixelPayload = Record<string, unknown>;

function newEventUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16);
    const value = ch === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === "function" ? fn : null;
}

function trackingAllowed(): boolean {
  return trackingPixelsAllowed() && pixelAllowedHere();
}

function rememberOnce(eventId: string): boolean {
  try {
    const key = `ofk_meta:${eventId}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

function pixel(eventName: string, data: PixelPayload, eventId: string, leadOnly = false) {
  const fn = fbq();
  if (!fn || !trackingAllowed()) return;
  if (leadOnly) fn("trackSingle", META_LEAD_PIXEL_ID, eventName, data, { eventID: eventId });
  else fn("track", eventName, data, { eventID: eventId });
}

function lineContents(lines: OrderLine[]) {
  return lines.map(line => ({ id: line.id, quantity: 1, item_price: chargedUsd(line.amountCents) }));
}

/**
 * GTM-M7B83SRK's Google tag forwards hits to this Stape server container
 * (server_container_url). On /one-feature-kit the container blocks its Facebook
 * PageView tag and has no ViewContent tag, so the browser also beacons the same
 * event ids the pixel and meta-capi use. The collect names are the ones that
 * tag maps: page_view → PageView and view_item → ViewContent.
 * cid has to be on the query string. A body-only beacon is a 400.
 */
function sendStapeEvent(
  eventName: string,
  metaEvent: string,
  eventId: string,
  params: Record<string, string | number> = {},
) {
  if (isTestTraffic()) return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const extras: Record<string, string | number> = { ...params };
  try {
    const match = browserMatch();
    if (match.fbp) extras["x-fb-ck-fbp"] = match.fbp;
    if (match.fbc) extras["x-fb-ck-fbc"] = match.fbc;
    if (match.fbclid) extras.fbclid = match.fbclid;
  } catch {
    /* A missing document still leaves the event id on the hit. */
  }
  let url = "";
  try {
    url = buildStapeCollectUrl(eventName, metaEvent, eventId, extras);
  } catch {
    return;
  }
  if (!url) return;
  try {
    const sent = navigator.sendBeacon(url);
    if (sent) return;
  } catch {
    /* Fall through to a keepalive fetch. */
  }
  try {
    void fetch(url, {
      method: "POST",
      keepalive: true,
      mode: "no-cors",
      credentials: "omit",
    });
  } catch {
    /* The page is going away. */
  }
}

const META_CAPI_URL = "https://backend-disconnected.invalid/functions/v1/meta-capi";
/** Public anon key. Same value the generated Supabase client ships to the browser. */
const META_CAPI_KEY = SUPABASE_PUBLISHABLE_KEY;

async function sendServerEvent(body: Record<string, unknown>) {
  if (isTestTraffic()) return;
  try {
    await fetch(META_CAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: META_CAPI_KEY,
        Authorization: `Bearer ${META_CAPI_KEY}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (error) {
    console.error("[ofk-meta] server event failed", error);
  }
}

type EarlyKitMetaIds = { uuid: string; pageViewId: string; viewContentId: string };

/** Ids minted in index.html before paint, so the pixel PageView and meta-capi share one event id. */
function earlyKitMetaIds(): EarlyKitMetaIds | null {
  if (typeof window === "undefined") return null;
  const ids = (window as Window & { __ofkMetaIds?: EarlyKitMetaIds }).__ofkMetaIds;
  if (!ids || typeof ids.uuid !== "string" || typeof ids.pageViewId !== "string" || typeof ids.viewContentId !== "string") {
    return null;
  }
  return ids;
}

/** fb.1.<time>.<fbclid> → the click id meta-capi already accepts. */
export function fbclidFromFbc(fbc: string | undefined): string | undefined {
  if (!fbc) return undefined;
  const parts = fbc.split(".");
  if (parts.length < 4 || parts[0] !== "fb") return undefined;
  const fbclid = parts.slice(3).join(".");
  return fbclid || undefined;
}

/**
 * meta-capi returns 400 unless it has email, fbclid, or fbp.
 * An fbc cookie counts because it carries the fbclid. external_id alone does not.
 */
export function kitCapiCanSend(match: {
  email?: string;
  fbc?: string;
  fbclid?: string;
  fbp?: string;
}): boolean {
  return Boolean(match.email || match.fbclid || match.fbp || fbclidFromFbc(match.fbc));
}

const FBP_WAIT_MS = 1800;
const FBP_POLL_MS = 100;

/** Poll until the pixel writes _fbp, or another identifier is already present. */
export async function waitForKitCapiMatch(timeoutMs = FBP_WAIT_MS): Promise<ReturnType<typeof browserMatch> | null> {
  const ready = (match: ReturnType<typeof browserMatch>) => {
    if (!kitCapiCanSend(match)) return null;
    const fbclid = match.fbclid || fbclidFromFbc(match.fbc);
    return fbclid && fbclid !== match.fbclid ? { ...match, fbclid } : match;
  };
  try {
    const first = ready(browserMatch());
    if (first) return first;
  } catch {
    return null;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, FBP_POLL_MS));
    if (typeof window === "undefined") return null;
    try {
      const next = ready(browserMatch());
      if (next) return next;
    } catch {
      return null;
    }
  }
  return null;
}

function browserMatch() {
  const attr = captureKitAttribution();
  const draft = loadDraft();
  const email = (draft.contact.email || draft.lead.email || "").trim().toLowerCase();
  return {
    fbp: attr.fbp || undefined,
    fbc: attr.fbc || undefined,
    fbclid: attr.fbclid || undefined,
    email: email.includes("@") ? email : undefined,
    event_source_url: window.location.href,
    client_user_agent: navigator.userAgent,
  };
}

export { KIT_UTM_FIRST_TOUCH_KEY };

function kitUtmStores(): Storage[] {
  if (typeof window === "undefined") return [];
  const stores: Storage[] = [];
  for (const read of [() => window.sessionStorage, () => window.localStorage]) {
    try {
      const storage = read();
      if (storage) stores.push(storage);
    } catch {
      /* Safari private mode throws when the store is touched. */
    }
  }
  return stores;
}

function writeKitUtmStorage(fields: KitContactUtms) {
  const raw = JSON.stringify(fields);
  for (const storage of kitUtmStores()) {
    try {
      storage.setItem(KIT_UTM_FIRST_TOUCH_KEY, raw);
    } catch {
      /* Private browsing can block one of the two stores. */
    }
  }
}

/**
 * Remember the first campaign that reached the kit funnel.
 * A stored visit wins. The current URL fills a visit that has no campaign yet.
 * An all-empty record does not lock the visit, so a later tagged URL can still land.
 * The same capture writes localStorage and the first-party cookie.
 */
export function captureKitFirstTouchUtms(): KitContactUtms {
  if (typeof window === "undefined") return kitUtmFields(null);
  try {
    const next = kitUtmFields(captureKitAttribution());
    writeKitUtmStorage(next);
    return next;
  } catch {
    return kitUtmFields(null);
  }
}

/** The four contact UTMs sent with kit checkout create. Empty string when unknown. */
export function kitCheckoutUtms(): KitContactUtms {
  return captureKitFirstTouchUtms();
}

/** PageView on every kit step, plus ViewContent on the sales page. */
export function trackKitStepView(pathname: string) {
  captureKitFirstTouchUtms();
  const step = kitStepForPath(pathname);
  if (step) {
    const claim = claimKitPageView(step, pathname);
    // The inline script already inserted this view id, or a checkout view is inside the 30s window.
    if (claim.send) {
      void import("./events").then(({ trackKitEvent }) =>
        trackKitEvent("view", { step, properties: claim.viewId ? { view_id: claim.viewId } : null }),
      );
    }
  }
  try {
    if (!trackingAllowed()) return;
    const early = earlyKitMetaIds();
    const uuid = early?.uuid || newEventUuid();
    const pageViewId = early?.pageViewId || kitPageViewEventId(uuid);
    const alreadyInHead =
      typeof window !== "undefined" &&
      (window as Window & { __ofkPixelPageView?: string }).__ofkPixelPageView === pageViewId;
    if (!alreadyInHead) pixel("PageView", {}, pageViewId);
    const viewId = early?.viewContentId || kitViewContentEventId(uuid);
    const view = pathname === FUNNEL_ROUTES.sales ? {
      value: 27,
      currency: "USD",
      content_ids: ["kit"],
      content_name: "The GoHighLevel One Feature Kit",
      content_type: "product",
      contents: [{ id: "kit", quantity: 1, item_price: 27 }],
      num_items: 1,
    } : null;
    if (view) pixel("ViewContent", view, viewId);
    sendStapeEvent("page_view", "PageView", pageViewId);
    if (view) sendStapeEvent("view_item", "ViewContent", viewId, { value: view.value, currency: view.currency });
    void (async () => {
      const match = await waitForKitCapiMatch();
      if (!match) return;
      await sendServerEvent({ event_name: "PageView", event_id: pageViewId, currency: "USD", ...match });
      if (view) await sendServerEvent({ event_name: "ViewContent", event_id: viewId, ...view, ...match });
    })();
  } catch (error) {
    console.error("[ofk-meta] step view failed", error);
  }
}

/** Lead (seasoned pixel only) and InitiateCheckout, using the ids the server returned. */
export function trackKitCheckoutStarted(input: {
  bumps: KitBumps;
  sessionId: string;
  leadEventId: string;
  initiateCheckoutEventId?: string;
}) {
  try {
  if (!trackingAllowed() || !input.sessionId || !input.leadEventId) return;
  const lines = checkoutLines(input.bumps);
  const value = chargedUsd(lines.reduce((sum, line) => sum + line.amountCents, 0));
  if (rememberOnce(input.leadEventId)) {
    pixel("Lead", { content_name: "The GoHighLevel One Feature Kit", content_category: "one-feature-kit" }, input.leadEventId, true);
  }
  const checkoutId = input.initiateCheckoutEventId || kitInitiateCheckoutEventId(input.sessionId);
  if (!rememberOnce(checkoutId)) return;
  pixel("InitiateCheckout", {
    value,
    currency: "USD",
    content_ids: lines.map(line => line.id),
    contents: lineContents(lines),
    content_type: "product",
    num_items: lines.length,
  }, checkoutId);
  } catch (error) {
    console.error("[ofk-meta] checkout events failed", error);
  }
}

/** Browser Purchase after Stripe confirms the checkout. Skips comped and $0 orders. */
export function trackKitCheckoutPurchase(input: {
  sessionId: string;
  amountTotal: number;
  comped: boolean;
  lines: OrderLine[];
}) {
  try {
  if (!trackingAllowed() || input.comped || !(input.amountTotal > 0)) return;
  const eventId = kitPurchaseEventId(input.sessionId);
  if (!rememberOnce(eventId)) return;
  pixel("Purchase", {
    value: input.amountTotal,
    currency: "USD",
    content_ids: input.lines.map(line => line.id),
    contents: lineContents(input.lines),
    content_type: "product",
    content_name: "The GoHighLevel One Feature Kit",
    num_items: input.lines.length,
    order_id: input.sessionId,
  }, eventId);
  } catch (error) {
    console.error("[ofk-meta] checkout purchase failed", error);
  }
}

/** Browser Purchase after a one-click upsell or future downsell charge. */
export function trackKitUpsellPurchase(input: {
  paymentIntentId: string;
  offerId: string;
  amountCents: number;
  contentName: string;
  comped: boolean;
}) {
  try {
  if (!trackingAllowed() || input.comped || input.amountCents <= 0 || !input.paymentIntentId.startsWith("pi_")) return;
  const eventId = kitPurchaseEventId(input.paymentIntentId);
  if (!rememberOnce(eventId)) return;
  const value = chargedUsd(input.amountCents);
  pixel("Purchase", {
    value,
    currency: "USD",
    content_ids: [input.offerId],
    contents: [{ id: input.offerId, quantity: 1, item_price: value }],
    content_type: "product",
    content_name: input.contentName,
    num_items: 1,
    order_id: input.paymentIntentId,
  }, eventId);
  } catch (error) {
    console.error("[ofk-meta] upsell purchase failed", error);
  }
}

export function kitBrowserTracking() {
  const test = typeof window !== "undefined" && isTestTraffic();
  if (typeof window === "undefined" || hasOptedOutOfTracking()) {
    return { tracking_optout: true as const, is_test: test };
  }
  const attr = captureKitAttribution();
  const checkoutPage = window.location.pathname.slice(0, 500);
  return {
    fbp: attr.fbp || undefined,
    fbc: attr.fbc || undefined,
    fbclid: attr.fbclid || undefined,
    utm_source: attr.utm_source,
    utm_medium: attr.utm_medium,
    utm_campaign: attr.utm_campaign,
    utm_content: attr.utm_content,
    utm_term: attr.utm_term,
    utm_id: attr.utm_id,
    landing_page: attr.landing_page || undefined,
    referrer: attr.referrer || undefined,
    checkout_page: checkoutPage || undefined,
    page_url: window.location.href.slice(0, 500),
    tracking_optout: false as const,
    is_test: test,
  };
}
