/**
 * First-touch ad attribution for the One Feature Kit.
 *
 * Mobile Safari can drop localStorage between the ad click and checkout
 * (ITP, a new document, or a subdomain hop). The landing hit is stored in
 * sessionStorage, localStorage, and a first-party cookie. Checkout reads
 * a field from the URL when nothing is stored yet, then sessionStorage,
 * localStorage, and that cookie.
 *
 * A stored first touch is kept. A later URL only fills fields that are still blank.
 */
import { kitFbcFromClick } from "../../../supabase/functions/_shared/kit-meta";
import { registrableDomain } from "./stapeCollect";

export const KIT_ATTR_STORAGE_KEY = "ofk_attr_v1";
export const KIT_ATTR_COOKIE = "ofk_attr";
/** Previous 4-field campaign record. Still read so an in-progress visit is not split. */
export const KIT_UTM_FIRST_TOUCH_KEY = "ofk_utm_first_touch";
export const KIT_ATTR_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const SITE_UTM_KEY = "utm_attribution";
const LEGACY_FBCLID_KEY = "fbclid";
const LEGACY_FBC_KEY = "fb_fbc";
const LEGACY_FBP_KEY = "fb_fbp";

export const KIT_ATTR_FIELDS = [
  "fbclid",
  "fbc",
  "fbp",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "landing_page",
  "referrer",
] as const;

export type KitAttributionField = (typeof KIT_ATTR_FIELDS)[number];
export type KitAttribution = Record<KitAttributionField, string>;

const LIMIT: Record<KitAttributionField, number> = {
  fbclid: 500,
  fbc: 500,
  fbp: 200,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  utm_id: 200,
  landing_page: 500,
  referrer: 500,
};

const URL_FIELDS = [
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
] as const;

const CONTACT_UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function emptyKitAttribution(): KitAttribution {
  return {
    fbclid: "",
    fbc: "",
    fbp: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    utm_id: "",
    landing_page: "",
    referrer: "",
  };
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, max);
}

function first(...values: string[]): string {
  for (const value of values) if (value) return value;
  return "";
}

export function parseKitAttribution(raw: string | null | undefined): Partial<KitAttribution> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<KitAttribution> = {};
    for (const key of KIT_ATTR_FIELDS) {
      const value = clip((parsed as Record<string, unknown>)[key], LIMIT[key]);
      if (value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeKitAttribution(attr: KitAttribution): string {
  const out: Partial<KitAttribution> = {};
  for (const key of KIT_ATTR_FIELDS) if (attr[key]) out[key] = attr[key];
  return JSON.stringify(out);
}

/** document.cookie value for one name. Ignores Path, Domain, and the other attributes. */
export function readCookieValue(header: string, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
}

/** .saassuite.ai on this site. Other kit hosts get their own registrable domain. */
export function kitAttributionCookieDomain(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return null;
  if (host === "saassuite.ai" || host.endsWith(".saassuite.ai")) return ".saassuite.ai";
  const domain = registrableDomain(host);
  return domain ? `.${domain}` : null;
}

export function kitAttributionCookieAssignment(payload: string, hostname: string, secure: boolean): string {
  const parts = [
    `${KIT_ATTR_COOKIE}=${encodeURIComponent(payload)}`,
    "Path=/",
    `Max-Age=${KIT_ATTR_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  const domain = kitAttributionCookieDomain(hostname);
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export type KitAttributionSources = {
  search: string;
  pageUrl: string;
  referrer: string;
  sessionRaw: string | null;
  localRaw: string | null;
  cookieHeader: string;
  legacySessionRaw: string | null;
  legacyLocalRaw: string | null;
  siteRaw: string | null;
  legacyFbclid: string | null;
  legacyFbc: string | null;
  legacyFbp: string | null;
  nowMs: number;
};

function fromSearch(search: string): Partial<KitAttribution> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Partial<KitAttribution> = {};
  for (const key of URL_FIELDS) {
    const value = clip(params.get(key) ?? "", LIMIT[key]);
    if (value) out[key] = value;
  }
  return out;
}

function urlHasContactUtm(url: Partial<KitAttribution>): boolean {
  return CONTACT_UTM_FIELDS.some((key) => Boolean(url[key]));
}

/**
 * Stored first touch wins. Blank fields fall through the URL, then
 * sessionStorage, localStorage, and the first-party cookie (already merged
 * into the stored record), then the older site landing keys.
 */
export function resolveKitAttribution(input: KitAttributionSources): KitAttribution {
  const session = parseKitAttribution(input.sessionRaw);
  const local = parseKitAttribution(input.localRaw);
  const cookie = parseKitAttribution(readCookieValue(input.cookieHeader, KIT_ATTR_COOKIE));
  const legacySession = parseKitAttribution(input.legacySessionRaw);
  const legacyLocal = parseKitAttribution(input.legacyLocalRaw);
  const site = parseKitAttribution(input.siteRaw);
  const url = fromSearch(input.search);
  const out = emptyKitAttribution();
  const stored = (key: KitAttributionField) =>
    first(session[key] ?? "", local[key] ?? "", cookie[key] ?? "", legacySession[key] ?? "", legacyLocal[key] ?? "");

  for (const key of URL_FIELDS) {
    out[key] = stored(key) || url[key] || "";
  }
  if (!urlHasContactUtm(url)) {
    for (const key of CONTACT_UTM_FIELDS) {
      if (!out[key]) out[key] = site[key] ?? "";
    }
  }
  if (!out.utm_term) out.utm_term = site.utm_term ?? "";
  if (!out.utm_id) out.utm_id = site.utm_id ?? "";
  if (!out.fbclid) out.fbclid = clip(input.legacyFbclid, LIMIT.fbclid);

  const liveFbp = clip(readCookieValue(input.cookieHeader, "_fbp"), LIMIT.fbp);
  out.fbp = liveFbp || stored("fbp") || clip(input.legacyFbp, LIMIT.fbp);

  out.fbc = stored("fbc") || clip(readCookieValue(input.cookieHeader, "_fbc"), LIMIT.fbc) || clip(input.legacyFbc, LIMIT.fbc);
  if (!out.fbc && out.fbclid) out.fbc = kitFbcFromClick(out.fbclid, input.nowMs);

  const clickOnThisUrl = Boolean(url.fbclid || urlHasContactUtm(url) || url.utm_term || url.utm_id);
  const storedLanding = stored("landing_page");
  const storedReferrer = stored("referrer");
  if (storedLanding) out.landing_page = storedLanding;
  else if (clickOnThisUrl) out.landing_page = clip(input.pageUrl, LIMIT.landing_page);
  else out.landing_page = site.landing_page ?? "";
  if (storedReferrer) out.referrer = storedReferrer;
  else if (clickOnThisUrl) out.referrer = clip(input.referrer, LIMIT.referrer);
  else out.referrer = site.referrer ?? "";

  return out;
}

function storageGet(
  read: () => Storage | null | undefined,
  key: string,
  blocked?: { threw: boolean },
): string | null {
  try {
    return read()?.getItem(key) ?? null;
  } catch {
    if (blocked) blocked.threw = true;
    return null;
  }
}

function cookieHeader(): string {
  try {
    if (typeof document === "undefined") return "";
    return document.cookie || "";
  } catch {
    return "";
  }
}

/** Last resolved visit when storage throws and the cookie is missing a field. */
let memoryAttribution: KitAttribution | null = null;

function withMemoryAttribution(attr: KitAttribution, storageThrew: boolean): KitAttribution {
  if (!storageThrew || !memoryAttribution) return attr;
  const out = { ...attr };
  for (const key of KIT_ATTR_FIELDS) {
    if (!out[key]) out[key] = memoryAttribution[key];
  }
  return out;
}

function storageSet(read: () => Storage | null | undefined, key: string, value: string) {
  try {
    read()?.setItem(key, value);
  } catch {
    /* Private mode can block one store. The cookie and the other store still count. */
  }
}

function mirrorLegacyIds(attr: KitAttribution) {
  try {
    if (attr.fbclid && !localStorage.getItem(LEGACY_FBCLID_KEY)) localStorage.setItem(LEGACY_FBCLID_KEY, attr.fbclid);
    if (attr.fbc && !localStorage.getItem(LEGACY_FBC_KEY)) localStorage.setItem(LEGACY_FBC_KEY, attr.fbc);
    if (attr.fbp && !localStorage.getItem(LEGACY_FBP_KEY)) localStorage.setItem(LEGACY_FBP_KEY, attr.fbp);
  } catch {
    /* The ofk_attr cookie is the copy checkout reads when localStorage is gone. */
  }
}

/** Read and refresh the first touch. Safe to call on every funnel step. */
export function captureKitAttribution(nowMs = Date.now()): KitAttribution {
  if (typeof window === "undefined") return emptyKitAttribution();
  try {
    const loc = window.location;
    const origin = typeof loc.origin === "string" ? loc.origin : "";
    const pageUrl = `${origin}${loc.pathname || ""}${loc.search || ""}`;
    const blocked = { threw: false };
    let referrer = "";
    try {
      referrer = typeof document !== "undefined" ? document.referrer || "" : "";
    } catch {
      referrer = "";
    }
    const resolved = withMemoryAttribution(resolveKitAttribution({
      search: loc.search || "",
      pageUrl,
      referrer,
      sessionRaw: storageGet(() => window.sessionStorage, KIT_ATTR_STORAGE_KEY, blocked),
      localRaw: storageGet(() => window.localStorage, KIT_ATTR_STORAGE_KEY, blocked),
      cookieHeader: cookieHeader(),
      legacySessionRaw: storageGet(() => window.sessionStorage, KIT_UTM_FIRST_TOUCH_KEY, blocked),
      legacyLocalRaw: storageGet(() => window.localStorage, KIT_UTM_FIRST_TOUCH_KEY, blocked),
      siteRaw: storageGet(() => window.localStorage, SITE_UTM_KEY, blocked),
      legacyFbclid: storageGet(() => window.localStorage, LEGACY_FBCLID_KEY, blocked),
      legacyFbc: storageGet(() => window.localStorage, LEGACY_FBC_KEY, blocked),
      legacyFbp: storageGet(() => window.localStorage, LEGACY_FBP_KEY, blocked),
      nowMs,
    }), blocked.threw);
    const raw = serializeKitAttribution(resolved);
    if (raw !== "{}") memoryAttribution = resolved;
    else if (!blocked.threw) memoryAttribution = null;
    if (raw !== "{}") {
      storageSet(() => window.sessionStorage, KIT_ATTR_STORAGE_KEY, raw);
      storageSet(() => window.localStorage, KIT_ATTR_STORAGE_KEY, raw);
      try {
        document.cookie = kitAttributionCookieAssignment(raw, loc.hostname || "", loc.protocol === "https:");
      } catch {
        /* A blocked cookie still leaves sessionStorage and localStorage. */
      }
      mirrorLegacyIds(resolved);
    }
    return resolved;
  } catch {
    return emptyKitAttribution();
  }
}
