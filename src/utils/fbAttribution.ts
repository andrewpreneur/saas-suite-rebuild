import { checkoutSurfaceLabel } from "@/lib/checkoutSurface";
import { isTestTraffic } from "@/utils/testTraffic";

/**
 * Capture facebook click id (fbclid) from URL and persist it to localStorage
 * so it survives across the signup flow. Read with getStoredFbclid() when
 * firing signup / purchase webhooks.
 */

const STORAGE_KEY = "fbclid";
const FBC_STORAGE_KEY = "fb_fbc";
const FBP_STORAGE_KEY = "fb_fbp";
const UTM_STORAGE_KEY = "utm_attribution";
const LAST_TOUCH_KEY = "utm_attribution_last";
const HANDOFF_TOKEN_KEY = "signup_attribution_handoff";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
] as const;

export type AttributionData = Partial<Record<(typeof UTM_KEYS)[number] | "referrer" | "landing_page", string>>;
export type LastTouchData = AttributionData & { fbclid?: string; touched_at?: string };

/**
 * First-touch merge. A URL with UTM tags replaces the stored campaign.
 * A later page with no UTM tags keeps the original landing page.
 */
export function applyFirstTouch(
  existing: AttributionData,
  incoming: AttributionData,
  hasAnyUtm: boolean,
  referrer: string,
  landingPage: string,
): AttributionData {
  if (hasAnyUtm) {
    const merged: AttributionData = { ...incoming };
    if (referrer) merged.referrer = referrer;
    merged.landing_page = landingPage;
    return merged;
  }
  const merged: AttributionData = { ...existing, ...incoming };
  if (!merged.referrer && referrer) merged.referrer = referrer;
  if (!merged.landing_page) merged.landing_page = landingPage;
  return merged;
}

/** Last-touch merge. The current page always becomes the landing page. */
export function applyLastTouch(
  existing: LastTouchData,
  incoming: AttributionData & { fbclid?: string },
  referrer: string,
  landingPage: string,
  touchedAt: string,
): LastTouchData {
  const next: LastTouchData = { ...existing };
  for (const key of UTM_KEYS) {
    if (incoming[key]) next[key] = incoming[key];
  }
  if (incoming.fbclid) next.fbclid = incoming.fbclid;
  if (referrer) next.referrer = referrer;
  next.landing_page = landingPage;
  next.touched_at = touchedAt;
  return next;
}

export function captureFbclid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get("fbclid");
    if (fbclid) {
      localStorage.setItem(STORAGE_KEY, fbclid);
      return fbclid;
    }
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredFbclid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get("fbclid");
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Capture Meta's click (_fbc) and browser (_fbp) identifiers at FIRST LANDING.
 *
 * fbc is first-touch-wins: the ad click usually happens days before the
 * purchase, and its embedded timestamp must be the click time — synthesizing it
 * at checkout produces a mismatched fbc that Meta attributes as a view, not a
 * 7-day click. So we snapshot it once and never overwrite it.
 *
 * fbp is a rotating browser id owned by the pixel: always prefer the live
 * cookie, and only fall back to our stored copy if the cookie is gone.
 */
export function captureFbCookies(): { fbc: string | null; fbp: string | null } {
  if (typeof window === "undefined") return { fbc: null, fbp: null };
  try {
    // --- fbc ---
    let fbc = localStorage.getItem(FBC_STORAGE_KEY);
    if (!fbc) {
      const cookieFbc = readCookie("_fbc");
      if (cookieFbc) {
        fbc = cookieFbc;
      } else {
        // No pixel cookie yet (blocked, or pixel not loaded on this hit) —
        // synthesize from the fbclid in the current URL using NOW as the click
        // time, which is accurate only on the landing hit. Hence: landing only.
        const fbclid = new URLSearchParams(window.location.search).get("fbclid");
        if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
      }
      if (fbc) localStorage.setItem(FBC_STORAGE_KEY, fbc);
    }

    // --- fbp ---
    const cookieFbp = readCookie("_fbp");
    if (cookieFbp) localStorage.setItem(FBP_STORAGE_KEY, cookieFbp);
    const fbp = cookieFbp || localStorage.getItem(FBP_STORAGE_KEY);

    return { fbc: fbc || null, fbp: fbp || null };
  } catch {
    return { fbc: null, fbp: null };
  }
}

/** First-touch fbc (fb.1.<click_time_ms>.<fbclid>). */
export function getStoredFbc(): string | null {
  return captureFbCookies().fbc;
}

/** Current _fbp browser id (live cookie preferred). */
export function getStoredFbp(): string | null {
  return captureFbCookies().fbp;
}



/**
 * Capture UTM + referrer/landing data from the current URL and persist to
 * localStorage. First-touch wins (don't overwrite existing stored values
 * unless new UTM params are present in the current URL).
 */
export function captureAttribution(): AttributionData {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const existingRaw = localStorage.getItem(UTM_STORAGE_KEY);
    const existing: AttributionData = existingRaw ? JSON.parse(existingRaw) : {};

    const incoming: AttributionData = {};
    let hasAnyUtm = false;
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) {
        incoming[key] = v;
        if (key.startsWith("utm_")) hasAnyUtm = true;
      }
    }

    const landingPage = window.location.origin + window.location.pathname;
    const merged = applyFirstTouch(existing, incoming, hasAnyUtm, document.referrer, landingPage);
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
    captureLastTouch();
    return merged;
  } catch {
    return {};
  }
}

export function getStoredAttribution(): AttributionData {
  if (typeof window === "undefined") return {};
  try {
    // Refresh from any current URL params, then return merged
    return captureAttribution();
  } catch {
    return {};
  }
}

/** Latest page, referrer, campaign tags, and click ids. Updated on every page. */
export function captureLastTouch(): LastTouchData {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const existingRaw = localStorage.getItem(LAST_TOUCH_KEY);
    const existing: LastTouchData = existingRaw ? JSON.parse(existingRaw) : {};
    const incoming: AttributionData & { fbclid?: string } = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) incoming[key] = value;
    }
    const fbclid = params.get("fbclid");
    if (fbclid) incoming.fbclid = fbclid;
    const next = applyLastTouch(
      existing,
      incoming,
      document.referrer,
      window.location.origin + window.location.pathname,
      new Date().toISOString(),
    );
    localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(next));
    return next;
  } catch {
    return {};
  }
}

export function getLastTouch(): LastTouchData {
  if (typeof window === "undefined") return {};
  try {
    return captureLastTouch();
  } catch {
    return {};
  }
}

function putAttribution(out: Record<string, string>, key: string, value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed) out[key] = trimmed.slice(0, 480);
}

/**
 * First-touch fields keep their existing names. Last-touch fields are added
 * beside them so checkout can tell the original landing page from the page
 * that actually started payment.
 */
export function readCheckoutAttribution(plan?: string): Record<string, string> {
  const first = getStoredAttribution();
  const last = getLastTouch();
  const fbclid = getStoredFbclid();
  const { fbc, fbp } = captureFbCookies();
  const page = typeof window === "undefined" ? "" : window.location.pathname;
  const out: Record<string, string> = {};
  putAttribution(out, "utm_source", first.utm_source);
  putAttribution(out, "utm_medium", first.utm_medium);
  putAttribution(out, "utm_campaign", first.utm_campaign);
  putAttribution(out, "utm_term", first.utm_term);
  putAttribution(out, "utm_content", first.utm_content);
  putAttribution(out, "utm_id", first.utm_id);
  putAttribution(out, "gclid", first.gclid);
  putAttribution(out, "referrer", first.referrer);
  putAttribution(out, "landing_page", first.landing_page);
  putAttribution(out, "fbclid", fbclid);
  putAttribution(out, "fbc", fbc);
  putAttribution(out, "fbp", fbp);
  putAttribution(out, "last_landing_page", last.landing_page);
  putAttribution(out, "last_referrer", last.referrer);
  putAttribution(out, "last_utm_source", last.utm_source);
  putAttribution(out, "last_utm_medium", last.utm_medium);
  putAttribution(out, "last_utm_campaign", last.utm_campaign);
  putAttribution(out, "last_utm_term", last.utm_term);
  putAttribution(out, "last_utm_content", last.utm_content);
  putAttribution(out, "last_utm_id", last.utm_id);
  putAttribution(out, "last_gclid", last.gclid);
  putAttribution(out, "last_fbclid", last.fbclid);
  putAttribution(out, "last_touch_at", last.touched_at);
  putAttribution(out, "checkout_page", page);
  if (plan && page) {
    putAttribution(out, "checkout_surface", checkoutSurfaceLabel(plan, page));
    putAttribution(out, "checkout_button", "Subscribe");
  }
  if (isTestTraffic()) out.is_test = "true";
  return out;
}

function getOrCreateHandoffToken(): string {
  const existing = sessionStorage.getItem(HANDOFF_TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID();
  sessionStorage.setItem(HANDOFF_TOKEN_KEY, token);
  return token;
}

/**
 * Store attribution on the server before leaving for OAuth. The random token
 * is the only link between the anonymous visit and the authenticated callback.
 */
export async function stageSignupAttribution(): Promise<string> {
  const token = getOrCreateHandoffToken();
  const attribution = getStoredAttribution();
  const fbclid = getStoredFbclid();
  const { fbc, fbp } = captureFbCookies();
  const { supabase } = await import("@/integrations/supabase/client");
  const { error } = await supabase.rpc("stage_signup_attribution", {
    p_token: token,
    p_fbclid: fbclid || null,
    p_gclid: attribution.gclid || null,
    p_utm_source: attribution.utm_source || null,
    p_utm_medium: attribution.utm_medium || null,
    p_utm_campaign: attribution.utm_campaign || null,
    p_utm_term: attribution.utm_term || null,
    p_utm_content: attribution.utm_content || null,
    p_utm_id: attribution.utm_id || null,
    p_referrer: attribution.referrer || null,
    p_landing_page: attribution.landing_page || null,
    p_fbc: fbc || null,
    p_fbp: fbp || null,
  });
  if (error) throw error;
  return token;
}

/** Build an OAuth callback URL containing both the handoff and original tags. */
export async function buildAttributedOAuthRedirect(path: string): Promise<string> {
  const token = getOrCreateHandoffToken();

  // Attribution is helpful, but it must never hold the Google sign-in button
  // hostage when the staging RPC is slow or temporarily unavailable.
  void Promise.race([
    stageSignupAttribution(),
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("Attribution staging timed out")), 1200)
    ),
  ]).catch((error) => {
    console.warn("Continuing OAuth without server-staged attribution:", error);
  });
  // Only the handoff token travels through the OAuth round-trip. The campaign
  // tags themselves are already staged server-side, and re-appending stored
  // ones put stale campaign params from an earlier visit onto the post-login
  // URL (e.g. an old fbclid/utm_campaign showing up on /app after sign-in).
  const url = new URL(path, window.location.origin);
  url.searchParams.set("attribution_token", token);
  return url.toString();
}

/** Claim the anonymous server handoff after OAuth has authenticated the user. */
export async function claimStagedAttribution(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("attribution_token") || sessionStorage.getItem(HANDOFF_TOKEN_KEY);
  if (!token) return false;
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc("claim_signup_attribution", { p_token: token });
  if (error) throw error;
  if (data) sessionStorage.removeItem(HANDOFF_TOKEN_KEY);
  return Boolean(data);
}

/**
 * Fire the lead-stage onboarding webhook with whatever attribution we have.
 * Idempotent per (email + source) via localStorage so we don't double-fire
 * across page navigations / OAuth round-trips. Safe to call from anywhere.
 */
const LEAD_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c80002d8-3a02-4e62-8f41-19256fdc1414";

export async function fireLeadWebhook(
  email: string,
  source: "email_entry" | "google_oauth" | "signup_complete" = "email_entry"
): Promise<void> {
  if (typeof window === "undefined") return;
  if (isTestTraffic()) return;
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return;
  const flagKey = `lead_webhook_sent:${source}:${normalized}`;
  try {
    if (localStorage.getItem(flagKey)) return;
    const fbclid = getStoredFbclid();
    const attribution = getStoredAttribution();
    await fetch(LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalized,
        stage: "lead",
        source,
        onboarding_completed: false,
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
      }),
    });
    localStorage.setItem(flagKey, "1");
  } catch (err) {
    console.error("fireLeadWebhook failed:", err);
  }
}
/**
 * Persist stored UTM / referrer / landing page / click IDs onto the user's
 * saas_suite_users row. First-touch wins server-side (only empty columns are
 * filled), so this is safe to call on every signup / sign-in.
 */
export async function persistAttribution(email: string): Promise<void> {
  if (typeof window === "undefined") return;
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return;
  try {
    const attribution = getStoredAttribution();
    const last = getLastTouch();
    const fbclid = getStoredFbclid();
    const { fbc, fbp } = captureFbCookies();
    const hasAny =
      !!fbclid || !!fbc || !!fbp || Object.values(attribution).some((v) => !!v) || Object.values(last).some((v) => !!v);
    if (!hasAny) return;

    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.rpc("save_user_attribution", {
      user_email: normalized,
      p_fbclid: fbclid || null,
      p_gclid: attribution.gclid || null,
      p_utm_source: attribution.utm_source || null,
      p_utm_medium: attribution.utm_medium || null,
      p_utm_campaign: attribution.utm_campaign || null,
      p_utm_term: attribution.utm_term || null,
      p_utm_content: attribution.utm_content || null,
      p_utm_id: attribution.utm_id || null,
      p_referrer: attribution.referrer || null,
      p_landing_page: attribution.landing_page || null,
      p_fbc: fbc || null,
      p_fbp: fbp || null,
    });
    await supabase.rpc("save_user_last_touch", {
      user_email: normalized,
      p_landing_page: last.landing_page || null,
      p_referrer: last.referrer || null,
      p_utm_source: last.utm_source || null,
      p_utm_medium: last.utm_medium || null,
      p_utm_campaign: last.utm_campaign || null,
      p_utm_term: last.utm_term || null,
      p_utm_content: last.utm_content || null,
      p_utm_id: last.utm_id || null,
      p_fbclid: last.fbclid || null,
      p_gclid: last.gclid || null,
      p_touched_at: last.touched_at || null,
    });
  } catch (err) {
    console.error("persistAttribution failed:", err);
  }
}
