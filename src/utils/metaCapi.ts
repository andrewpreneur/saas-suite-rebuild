/**
 * Meta Conversions API (server-side) + browser pixel deduplication.
 *
 * Every conversion is sent twice on purpose:
 *   1. browser pixel  -> fbq('track', name, data, { eventID })
 *   2. server CAPI    -> meta-capi edge function with the same event_id
 *
 * Matching event_name + event_id on both channels makes Meta count the
 * conversion ONCE and keep whichever copy has the better match quality.
 *
 * The email is sent raw to our own edge function only; it is SHA-256 hashed
 * server-side before it ever reaches Meta.
 */
import { getStoredFbclid, getStoredAttribution, captureFbCookies } from "@/utils/fbAttribution";
import { isTestTraffic } from "@/utils/testTraffic";
import { hasOptedOutOfTracking, trackingPixelsAllowed } from "@/utils/trackingConsent";
import { pixelAllowedHere } from "@/utils/pixelHost";

export type CapiEventName =
  | "CompleteRegistration"
  | "Lead"
  | "Purchase"
  | "Subscribe"
  | "Schedule"
  | "Contact";

interface ConversionOptions {
  email?: string | null;
  /** auth user id — used to build a stable event_id and external_id */
  userId?: string | null;
  /** explicit event_id override; defaults to `<prefix>_<userId|email>` */
  eventId?: string;
  value?: number;
  currency?: string;
  contentName?: string;
}

const EVENT_ID_PREFIX: Record<CapiEventName, string> = {
  CompleteRegistration: "signup",
  Lead: "lead",
  Purchase: "order",
  Subscribe: "subscribe",
  Schedule: "booking",
  Contact: "contact",
};

/**
 * Meta's Events Manager raises a quality warning when a conversion arrives
 * without value/currency, and Meta requires value > 0 — so every event
 * carries them, with non-monetary events reporting a nominal 1 USD.
 */
const DEFAULT_VALUE: Record<CapiEventName, number> = {
  CompleteRegistration: 1,
  Lead: 1,
  Purchase: 97,
  Subscribe: 97,
  Schedule: 1,
  Contact: 1,
};

/** Both Meta pixels active on this site (see index.html bootstrap). */
const META_PIXEL_IDS = ["745177780828109", "1601372838188959"];

/**
 * Meta Manual Advanced Matching: once the visitor's identity is known (signup,
 * login, purchase), re-initialize each pixel with their email as the third
 * init parameter. The pixel hashes it with SHA-256 in the browser before
 * sending, and every later event from this browser carries the match data —
 * this is Meta's recommended pattern for SPAs where identity arrives after
 * the initial page load.
 */
export function identifyMetaPixel(email?: string | null): void {
  if (typeof window === "undefined") return;
  const em = email?.trim().toLowerCase();
  if (!em) return;
  if (!trackingPixelsAllowed()) return;
  if (!pixelAllowedHere()) return;
  try {
    const flag = `meta_am_done:${em}`;
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, "1");
  } catch {
    /* storage unavailable — still attempt the init */
  }
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq !== "function") return;
    for (const pixelId of META_PIXEL_IDS) {
      fbq("init", pixelId, { em });
    }
  } catch (err) {
    console.error("[metaCapi] advanced matching failed", err);
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : undefined;
}

function buildEventId(eventName: CapiEventName, opts: ConversionOptions): string {
  if (opts.eventId) return opts.eventId;
  const prefix = EVENT_ID_PREFIX[eventName];
  const key =
    opts.userId ||
    (opts.email ? opts.email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") : "anon");
  return `${prefix}_${key}`;
}

/** Once-per-browser guard so re-renders / repeat sign-ins don't refire. */
function alreadySent(eventId: string, eventName: string): boolean {
  try {
    const flag = `meta_capi_sent:${eventName}:${eventId}`;
    if (localStorage.getItem(flag)) return true;
    localStorage.setItem(flag, "1");
    return false;
  } catch {
    return false;
  }
}

/**
 * Fire a conversion on BOTH the browser pixel and the server-side CAPI with a
 * shared event_id. Never throws — tracking must not break a signup/purchase.
 */
export async function trackConversion(
  eventName: CapiEventName,
  opts: ConversionOptions = {},
  { once = true }: { once?: boolean } = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  // Opt-out and QA test traffic: no pixel event and no server-side copy.
  if (!trackingPixelsAllowed() || isTestTraffic()) return;
  // Previews, *.lovableproject.com and embedded installs never report conversions.
  if (!pixelAllowedHere()) return;
  const eventId = buildEventId(eventName, opts);
  if (eventName === "Purchase" && typeof opts.value === "number" && opts.value <= 0) return;
  if (once && alreadySent(eventId, eventName)) return;

  const email = opts.email?.trim().toLowerCase() || undefined;
  // Attach advanced matching to every pixel in this browser as soon as the
  // visitor's email is known, so subsequent events (incl. PageView) match.
  identifyMetaPixel(email);
  const fbclid = getStoredFbclid();
  const { fbc, fbp } = captureFbCookies();
  const attribution = getStoredAttribution();
  const eventTime = Math.floor(Date.now() / 1000);
  const eventSourceUrl = window.location.href;

  const value = typeof opts.value === "number" ? opts.value : DEFAULT_VALUE[eventName];
  const currency = opts.currency ?? "USD";

  // 1. Browser pixel (with eventID so Meta can dedupe against the server copy)
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      const customData: Record<string, unknown> = { value, currency };
      if (opts.contentName) customData.content_name = opts.contentName;
      fbq("track", eventName, customData, { eventID: eventId });
    }
  } catch (err) {
    console.error("[metaCapi] pixel failed", err);
  }

  // 2. Server-side Conversions API
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.functions.invoke("meta-capi", {
      body: {
        event_name: eventName,
        event_id: eventId,
        event_time: eventTime,
        event_source_url: eventSourceUrl,
        email,
        external_id: opts.userId || undefined,
        fbclid: fbclid || undefined,
        // Real first-touch fbc beats anything the server can synthesize.
        fbc: fbc || undefined,
        fbp: fbp || readCookie("_fbp") || undefined,
        client_user_agent: navigator.userAgent,
        value,
        currency,
        utm_source: attribution.utm_source || undefined,
        utm_medium: attribution.utm_medium || undefined,
        utm_campaign: attribution.utm_campaign || undefined,
      },
    });
  } catch (err) {
    console.error("[metaCapi] server event failed", err);
  }
}

/** Signup completed (Google OAuth or email + password). */
export function trackSignupComplete(email?: string | null, userId?: string | null) {
  return trackConversion("CompleteRegistration", { email, userId });
}


/** Paid conversion. `value` is the plan price in USD. */
export function trackPurchase(
  email: string | null | undefined,
  value: number,
  contentName?: string,
  eventId?: string,
) {
  return trackConversion("Purchase", { email, value, contentName, eventId }, { once: false });
}

/** Appointment booked (strategy call, success call, onboarding call). */
export function trackSchedule(
  email: string | null | undefined,
  appointmentId?: string,
) {
  return trackConversion(
    "Schedule",
    { email, eventId: appointmentId ? `booking_${appointmentId}` : undefined },
    { once: false },
  );
}

/** Contact / inbound enquiry (support request, contact form). */
export function trackContact(email: string | null | undefined, contactId?: string) {
  return trackConversion("Contact", {
    email,
    eventId: contactId ? `contact_${contactId}` : undefined,
  });
}
