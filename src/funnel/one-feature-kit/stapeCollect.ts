/**
 * gtag-style GA4 collect hit for the Stape server container.
 * Stape returns 400 when cid is only in the body, so every field goes on the query string.
 * The _ga cookie is the client id GTM/gtag reads later, so both hits share one cid.
 * QA test traffic does not send a hit.
 */
import { isTestTraffic } from "@/utils/testTraffic";

export const STAPE_COLLECT_URL = "https://xyaheorc.usw.stape.io/g/collect";
export const STAPE_MEASUREMENT_ID = "G-UEFEWR349R8";

const GA_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;
const GA_CLIENT = /^GA1\.\d+\.(\d+\.\d+)$/;

let sessionId: string | null = null;
let hitIndex = 0;

/** eTLD+1 for the hosts this site serves. Null for localhost and IP addresses. */
export function registrableDomain(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join(".");
}

export function readGaClientId(cookie: string): string | null {
  const parts = cookie.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) !== "_ga") continue;
    const match = GA_CLIENT.exec(part.slice(eq + 1));
    if (match) return match[1];
  }
  return null;
}

export function gaCookieAssignment(cid: string, hostname: string, secure: boolean): string {
  const parts = [`_ga=GA1.1.${cid}`, "Path=/", `Max-Age=${GA_MAX_AGE_SECONDS}`, "SameSite=Lax"];
  const domain = registrableDomain(hostname);
  if (domain) parts.push(`Domain=.${domain}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function newClientId(): string {
  const rand = Math.floor(Math.random() * 2147483647);
  const ts = Math.floor(Date.now() / 1000);
  return `${rand}.${ts}`;
}

/** Read _ga, or mint GA1.1.X.Y and store it for two years on the registrable domain. */
export function ensureGaClientId(): string {
  const win = window;
  let existing: string | null = null;
  try {
    existing = readGaClientId(win.document.cookie || "");
  } catch {
    existing = null;
  }
  if (existing) return existing;
  const cid = newClientId();
  try {
    win.document.cookie = gaCookieAssignment(
      cid,
      win.location.hostname,
      win.location.protocol === "https:",
    );
  } catch {
    /* The hit still carries this cid when the cookie store is blocked. */
  }
  return cid;
}

function ensureSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const stored = window.sessionStorage.getItem("ofk_ga_sid");
    if (stored && /^\d+$/.test(stored)) {
      sessionId = stored;
      return stored;
    }
  } catch {
    /* Fall through and mint one. */
  }
  const sid = String(Math.floor(Date.now() / 1000));
  sessionId = sid;
  try {
    window.sessionStorage.setItem("ofk_ga_sid", sid);
  } catch {
    /* The query string still carries sid for this page. */
  }
  return sid;
}

export function buildStapeCollectUrl(
  eventName: string,
  metaEvent: string,
  eventId: string,
  params: Record<string, string | number> = {},
): string {
  if (isTestTraffic()) return "";
  const query = new URLSearchParams();
  query.set("v", "2");
  query.set("tid", STAPE_MEASUREMENT_ID);
  query.set("cid", ensureGaClientId());
  query.set("sid", ensureSessionId());
  query.set("_s", String(++hitIndex));
  query.set("seg", "0");
  query.set("en", eventName);
  query.set("ep.event_id", eventId);
  query.set("ep.event_name", metaEvent);
  try {
    const win = window;
    query.set("dl", win.location.href);
    if (win.document.referrer) query.set("dr", win.document.referrer);
    if (win.document.title) query.set("dt", win.document.title);
    if (win.navigator.language) query.set("ul", win.navigator.language.toLowerCase());
    const display = win.screen;
    if (display && display.width && display.height) query.set("sr", `${display.width}x${display.height}`);
    const search = new URLSearchParams(win.location.search);
    const campaign: Record<string, string | null> = {
      cs: search.get("utm_source"),
      cm: search.get("utm_medium"),
      cn: search.get("utm_campaign"),
      cc: search.get("utm_content"),
      ck: search.get("utm_term"),
    };
    for (const [key, value] of Object.entries(campaign)) {
      if (value) query.set(key, value);
    }
    const fbclid = search.get("fbclid");
    if (fbclid) query.set("ep.fbclid", fbclid);
  } catch {
    /* A missing document still leaves cid and the event id on the hit. */
  }
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "number") query.set(`epn.${key}`, String(value));
    else if (value && !query.has(`ep.${key}`)) query.set(`ep.${key}`, value);
  }
  return `${STAPE_COLLECT_URL}?${query.toString()}`;
}
