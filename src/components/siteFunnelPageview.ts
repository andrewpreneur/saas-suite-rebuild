import { canonicalFunnelPath } from "@/funnel/one-feature-kit/host";
import { getStoredAttribution, getStoredFbclid } from "@/utils/fbAttribution";
import { isTestTraffic } from "@/utils/testTraffic";
import { hasOptedOutOfTracking } from "@/utils/trackingConsent";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-site-event`;
const SESSION_KEY = "ss_track_session";

const APP_PREFIXES = ["/app", "/admin", "/auth", "/login", "/reset-password", "/v2-onboarding"];

const isAppPage = (path: string) =>
  APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const SITE_SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;

const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

/** The site_analytics session id, sent to Stripe as site_session_id. */
export function currentSiteAnalyticsSessionId(): string | null {
  try {
    const id = getSessionId();
    return SITE_SESSION_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

type Payload = Record<string, unknown>;

/** Beacon a site_analytics row. The kit page calls this without mounting SiteTracker. */
export function sendSiteEvent(payload: Payload, options?: { includeFunnel?: boolean }) {
  if (hasOptedOutOfTracking()) return;
  const trackedPath = typeof payload.path === "string" ? payload.path : window.location.pathname;
  if (!options?.includeFunnel && canonicalFunnelPath(trackedPath, window.location.hostname)) return;
  const attribution = getStoredAttribution();
  const body = JSON.stringify({
    session_id: getSessionId(),
    fbclid: getStoredFbclid() || undefined,
    gclid: attribution.gclid || undefined,
    utm_source: attribution.utm_source || undefined,
    utm_medium: attribution.utm_medium || undefined,
    utm_campaign: attribution.utm_campaign || undefined,
    utm_content: attribution.utm_content || undefined,
    utm_term: attribution.utm_term || undefined,
    referrer: attribution.referrer || undefined,
    ...payload,
    is_test: isTestTraffic(),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

const FUNNEL_PAGEVIEW_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"] as const;

/**
 * One pageview for a kit step. The funnel bundle does not mount SiteTracker,
 * so this is the only site_analytics row those pages write.
 * `path` is the canonical /one-feature-kit path, including on the kit host.
 */
export function trackFunnelPageview(path: string, userEmail?: string | null) {
  const extra: Payload = {
    path,
    event_type: "pageview",
    page_title: typeof document !== "undefined" ? document.title : undefined,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    is_app_page: false,
  };
  const email = typeof userEmail === "string" ? userEmail.trim().toLowerCase() : "";
  if (email.includes("@")) extra.user_email = email;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    for (const key of FUNNEL_PAGEVIEW_KEYS) {
      const value = params.get(key);
      if (value) extra[key] = value;
    }
  }
  sendSiteEvent(extra, { includeFunnel: true });
}

export { isAppPage };
