/**
 * Cookie / tracking consent state.
 *
 * Model: notice + opt-out. Analytics and advertising cookies run by default,
 * a banner discloses them, and the visitor can opt out at any time. Once a
 * visitor opts out we stop sending first-party analytics events and revoke
 * Meta Pixel consent so no further pixel events fire.
 */

import { isTestTraffic } from "./testTraffic";
import { WEBINAR_ATTRIBUTION_STORAGE_KEY } from "./webinarAttribution";
import { saveChoices } from "../lib/consent";

const KEY = "ss_tracking_optout";
const NOTICE_KEY = "ss_cookie_notice_ack";
export const CONSENT_EVENT = "ss-tracking-consent-changed";

export function hasOptedOutOfTracking(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Pixels, browser CAPI, and Stape. False when the visitor opted out or this
 * browser is QA test traffic. Site analytics still records test visits.
 */
export function trackingPixelsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (isTestTraffic()) return false;
  return !hasOptedOutOfTracking();
}

export function noticeAcknowledged(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(NOTICE_KEY) === "1" || localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}

export function acknowledgeNotice() {
  try {
    localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/** Revoke Meta Pixel consent so queued/future pixel events are dropped. */
function applyPixelConsent(optedOut: boolean) {
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("consent", optedOut ? "revoke" : "grant");
  } catch {
    /* pixel not ready */
  }
}

export function setTrackingOptOut(optedOut: boolean) {
  try {
    localStorage.setItem(KEY, optedOut ? "1" : "0");
    acknowledgeNotice();
    if (optedOut) {
      // Drop identifiers we only keep for ad attribution.
      ["fbclid", "fb_fbc", "fb_fbp", "utm_attribution", WEBINAR_ATTRIBUTION_STORAGE_KEY].forEach(
        (k) => localStorage.removeItem(k),
      );
      try {
        sessionStorage.removeItem(WEBINAR_ATTRIBUTION_STORAGE_KEY);
      } catch {
        /* session storage unavailable */
      }
    }
  } catch {
    /* storage unavailable */
  }
  applyPixelConsent(optedOut);
  if (optedOut) saveChoices({ analytics: "denied", advertising: "denied" });
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { optedOut } }));
  } catch {
    /* older browsers */
  }
}

/** Call once on boot so a stored opt-out survives reloads. */
export function initTrackingConsent() {
  if (typeof window === "undefined") return;
  if (hasOptedOutOfTracking()) applyPixelConsent(true);
}
