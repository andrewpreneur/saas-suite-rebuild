/**
 * Sticky QA flag. `?ss_test=1` (and the `?ofk_test=1` alias) marks this browser
 * for 24 hours so pixels, CAPI, Stape, and GHL webhooks stay quiet.
 * `?ss_test=0` clears the flag. The head script in index.html applies the same
 * rules before any tracking tag runs and sets `window.__ssTest`.
 */

export const SS_TEST_STORAGE_KEY = "ss_test";
export const SS_TEST_COOKIE = "ss_test";
export const SS_TEST_MAX_AGE_SECONDS = 60 * 60 * 24;

export type SsTestQuery = "on" | "off" | null;

type TestWindow = Window & { __ssTest?: boolean };

export function saasSuiteCookieDomain(hostname: string): ".saassuite.ai" | null {
  const host = (hostname || "").toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (host === "saassuite.ai" || host.endsWith(".saassuite.ai")) return ".saassuite.ai";
  return null;
}

/** `?ss_test=0` wins over `?ofk_test=1`. Anything else leaves the stored flag alone. */
export function ssTestQuery(search: string | null | undefined): SsTestQuery {
  try {
    const params = new URLSearchParams(search ?? "");
    if (params.get("ss_test") === "0") return "off";
    if (params.get("ss_test") === "1" || params.get("ofk_test") === "1") return "on";
    return null;
  } catch {
    return null;
  }
}

export function readCookieValue(cookie: string, name: string): string | null {
  const parts = (cookie || "").split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return trimmed.slice(eq + 1);
  }
  return null;
}

/** Set-Cookie assignment. Domain is added only on saassuite.ai. Max-Age=0 clears. */
export function ssTestCookieAssignment(hostname: string, enabled: boolean): string {
  const parts = [
    `${SS_TEST_COOKIE}=${enabled ? "1" : ""}`,
    "Path=/",
    `Max-Age=${enabled ? SS_TEST_MAX_AGE_SECONDS : 0}`,
    "SameSite=Lax",
  ];
  const domain = saasSuiteCookieDomain(hostname);
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

function browserWindow(): TestWindow | null {
  if (typeof window === "undefined") return null;
  return window as TestWindow;
}

function readStoredFlag(): boolean {
  const win = browserWindow();
  if (!win) return false;
  if (win.__ssTest === true) return true;
  try {
    if (win.localStorage.getItem(SS_TEST_STORAGE_KEY) === "1") return true;
  } catch {
    /* storage unavailable */
  }
  try {
    return readCookieValue(win.document.cookie || "", SS_TEST_COOKIE) === "1";
  } catch {
    return false;
  }
}

function writeFlag(enabled: boolean) {
  const win = browserWindow();
  if (!win) return;
  win.__ssTest = enabled;
  try {
    if (enabled) win.localStorage.setItem(SS_TEST_STORAGE_KEY, "1");
    else win.localStorage.removeItem(SS_TEST_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  try {
    const hostname = win.location.hostname || "";
    win.document.cookie = ssTestCookieAssignment(hostname, enabled);
    if (!enabled && saasSuiteCookieDomain(hostname)) {
      // Also drop a host-only cookie left by an older page.
      win.document.cookie = ssTestCookieAssignment("localhost", false);
    }
  } catch {
    /* cookies blocked */
  }
}

/**
 * Apply `?ss_test` / `?ofk_test` when present, then report the sticky flag.
 * Safe to call on every check. A page without the query does not refresh the cookie.
 */
export function isTestTraffic(): boolean {
  const win = browserWindow();
  if (!win) return false;
  let query: SsTestQuery = null;
  try {
    query = ssTestQuery(win.location.search);
  } catch {
    query = null;
  }
  if (query === "off") {
    writeFlag(false);
    return false;
  }
  if (query === "on") {
    writeFlag(true);
    return true;
  }
  const stored = readStoredFlag();
  if (stored) win.__ssTest = true;
  return stored;
}
