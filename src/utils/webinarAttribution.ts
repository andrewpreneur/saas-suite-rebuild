/**
 * First-touch ad attribution for Viral Meetings (WebinarKit) registration.
 *
 * WebinarKit snapshots window.location.href when ewk_v7.js executes, then posts
 * that query string to the registration endpoint. Those values are what show
 * up as the registrant's URL PARAMETERS. A later page that drops the query
 * string therefore records a blank source. This module remembers the first
 * landing and puts the saved parameters back on the page URL before that
 * script runs.
 *
 * Signup attribution in fbAttribution.ts stays as it is (it refreshes when a
 * new campaign arrives). This store is first-touch and expires on its own.
 */

export const WEBINAR_ATTRIBUTION_STORAGE_KEY = "ss_webinar_attribution";

/** Same localStorage keys written by fbAttribution.ts. Read only as a hole-fill. */
const LEGACY_UTM_KEY = "utm_attribution";
const LEGACY_FBCLID_KEY = "fbclid";

export const WEBINAR_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const WEBINAR_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

export type WebinarAttributionKey = (typeof WEBINAR_ATTRIBUTION_KEYS)[number];
export type WebinarAttributionField = WebinarAttributionKey | "referrer";
export type WebinarAttribution = Partial<Record<WebinarAttributionField, string>>;

const FIELDS: WebinarAttributionField[] = [...WEBINAR_ATTRIBUTION_KEYS, "referrer"];
const MAX_VALUE_LENGTH = 500;

export interface AttributionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type StoredAttribution = {
  expiresAt: number;
  values: WebinarAttribution;
};

export function cleanAttributionValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_VALUE_LENGTH);
}

/** Keep an external referrer. A same-site referrer is the previous page, not the ad. */
export function externalReferrer(
  referrer: string | null | undefined,
  pageOrigin: string | null | undefined,
): string | undefined {
  const value = cleanAttributionValue(referrer);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (pageOrigin && url.origin === pageOrigin) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function readAttributionParams(search: string): WebinarAttribution {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const values: WebinarAttribution = {};
  for (const key of WEBINAR_ATTRIBUTION_KEYS) {
    const value = cleanAttributionValue(params.get(key));
    if (value) values[key] = value;
  }
  return values;
}

/** First non-empty value wins. Empty incoming values never erase a stored one. */
export function mergeFirstTouch(
  existing: WebinarAttribution | null | undefined,
  incoming: WebinarAttribution | null | undefined,
): WebinarAttribution {
  const merged: WebinarAttribution = {};
  for (const key of FIELDS) {
    const previous = cleanAttributionValue(existing?.[key]);
    const next = cleanAttributionValue(incoming?.[key]);
    if (previous) merged[key] = previous;
    else if (next) merged[key] = next;
  }
  return merged;
}

export function parseStoredAttribution(raw: string | null, now: number): StoredAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; values?: unknown };
    if (
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now
    ) {
      return null;
    }
    if (!parsed.values || typeof parsed.values !== "object") return null;
    const values = mergeFirstTouch(null, parsed.values as WebinarAttribution);
    if (Object.keys(values).length === 0) return null;
    return { expiresAt: parsed.expiresAt, values };
  } catch {
    return null;
  }
}

function readFirstValid(stores: AttributionStorage[], now: number): StoredAttribution | null {
  for (const store of stores) {
    try {
      const parsed = parseStoredAttribution(store.getItem(WEBINAR_ATTRIBUTION_STORAGE_KEY), now);
      if (parsed) return parsed;
    } catch {
      /* storage unavailable */
    }
  }
  return null;
}

export function rememberFirstTouch(
  stores: AttributionStorage[],
  input: {
    search: string;
    referrer?: string | null;
    pageOrigin?: string | null;
    now?: number;
    fallback?: WebinarAttribution | null;
  },
): WebinarAttribution {
  const now = input.now ?? Date.now();
  const incoming = readAttributionParams(input.search);
  const referrer = externalReferrer(input.referrer, input.pageOrigin);
  if (referrer) incoming.referrer = referrer;

  const existing = readFirstValid(stores, now);
  // A saved first touch wins. Otherwise the current URL wins and any older
  // signup capture only fills keys this landing left blank.
  let values = mergeFirstTouch(existing?.values, incoming);
  if (!existing && input.fallback) {
    const fallback: WebinarAttribution = { ...input.fallback };
    const fallbackReferrer = externalReferrer(fallback.referrer, input.pageOrigin);
    if (fallbackReferrer) fallback.referrer = fallbackReferrer;
    else delete fallback.referrer;
    values = mergeFirstTouch(values, fallback);
  }
  if (Object.keys(values).length === 0) return {};

  const record: StoredAttribution = {
    expiresAt: existing?.expiresAt ?? now + WEBINAR_ATTRIBUTION_TTL_MS,
    values,
  };
  const raw = JSON.stringify(record);
  for (const store of stores) {
    try {
      store.setItem(WEBINAR_ATTRIBUTION_STORAGE_KEY, raw);
    } catch {
      /* storage unavailable */
    }
  }
  return values;
}

/**
 * Add stored parameters that the URL does not already have.
 * An existing non-empty parameter is left alone, and empty stored values are skipped.
 */
export function appendAttributionToUrl(
  url: string,
  attribution: WebinarAttribution | null | undefined,
): string {
  if (!attribution) return url;
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  let changed = false;
  for (const key of FIELDS) {
    const value = cleanAttributionValue(attribution[key]);
    if (!value) continue;
    if (cleanAttributionValue(params.get(key))) continue;
    params.set(key, value);
    changed = true;
  }
  if (!changed) return url;
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash}`;
}

function trackingOptedOut(): boolean {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    return storage?.getItem("ss_tracking_optout") === "1";
  } catch {
    return false;
  }
}

function browserStores(): AttributionStorage[] {
  if (typeof window === "undefined") return [];
  const stores: AttributionStorage[] = [];
  try {
    if (window.localStorage) stores.push(window.localStorage);
  } catch {
    /* ignore */
  }
  try {
    if (window.sessionStorage) stores.push(window.sessionStorage);
  } catch {
    /* ignore */
  }
  return stores;
}

/** Signup capture already on this browser, used only to fill a blank first touch. */
export function readLegacyAttribution(
  storage: AttributionStorage | null | undefined,
  pageOrigin?: string | null,
): WebinarAttribution {
  if (!storage) return {};
  try {
    const values: WebinarAttribution = {};
    const fbclid = cleanAttributionValue(storage.getItem(LEGACY_FBCLID_KEY));
    if (fbclid) values.fbclid = fbclid;
    const raw = storage.getItem(LEGACY_UTM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const key of WEBINAR_ATTRIBUTION_KEYS) {
        const value = cleanAttributionValue(parsed[key]);
        if (value && !values[key]) values[key] = value;
      }
      const referrer = externalReferrer(cleanAttributionValue(parsed.referrer), pageOrigin);
      if (referrer) values.referrer = referrer;
    }
    return values;
  } catch {
    return {};
  }
}

export function getStoredWebinarAttribution(now = Date.now()): WebinarAttribution {
  if (trackingOptedOut()) return {};
  return readFirstValid(browserStores(), now)?.values ?? {};
}

export function captureWebinarAttribution(now = Date.now()): WebinarAttribution {
  if (typeof window === "undefined" || trackingOptedOut()) return {};
  const stores = browserStores();
  const existing = readFirstValid(stores, now);
  return rememberFirstTouch(stores, {
    search: window.location.search || "",
    referrer: typeof document !== "undefined" ? document.referrer : "",
    pageOrigin: window.location.origin,
    now,
    fallback: existing ? null : readLegacyAttribution(stores[0], window.location.origin),
  });
}

/**
 * Remember this landing, then add any missing first-touch parameters to the
 * address bar so WebinarKit's script snapshot includes them.
 */
export function ensureWebinarAttributionOnPage(): WebinarAttribution {
  const values = captureWebinarAttribution();
  if (typeof window === "undefined" || !window.history?.replaceState) return values;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = appendAttributionToUrl(current, values);
  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
  return values;
}

/** Carry the saved first touch onto an in-app link or redirect. */
export function withWebinarAttribution(path: string): string {
  return appendAttributionToUrl(path, getStoredWebinarAttribution());
}
