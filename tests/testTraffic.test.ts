import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { buildStapeCollectUrl } from "../src/funnel/one-feature-kit/stapeCollect";
import { touchKitSession } from "../src/funnel/one-feature-kit/session";
import {
  isTestTraffic,
  saasSuiteCookieDomain,
  ssTestCookieAssignment,
  ssTestQuery,
  SS_TEST_MAX_AGE_SECONDS,
  SS_TEST_STORAGE_KEY,
} from "../src/utils/testTraffic";
import { kitCheckoutStartedSkipReason } from "../supabase/functions/_shared/kit-checkout-started";
import { kitStripeTrackingMetadata } from "../supabase/functions/_shared/kit-meta";
import {
  metaSendPlan,
  missingIsTestColumn,
  requestIsTest,
} from "../supabase/functions/_shared/test-traffic";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  };
}

function installBrowser(search = "", hostname = "onefeaturekit.com") {
  const previous = {
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    document: globalThis.document,
    navigator: globalThis.navigator,
  };
  const local = memoryStorage();
  const session = memoryStorage();
  const location = {
    search,
    hostname,
    href: `https://${hostname}/${search}`,
    pathname: "/",
    origin: `https://${hostname}`,
  };
  const win = {
    location,
    localStorage: local,
    sessionStorage: session,
    document: { cookie: "", referrer: "", title: "Test" },
    navigator: { language: "en-US", userAgent: "Test/1.0" },
    screen: { width: 1280, height: 800 },
  };
  Object.assign(globalThis, {
    window: win,
    localStorage: local,
    sessionStorage: session,
    document: win.document,
    navigator: win.navigator,
  });
  return {
    win,
    location,
    restore() {
      Object.assign(globalThis, previous);
    },
  };
}

test("ss_test query: 1 turns on, 0 turns off, ofk_test is an alias, 0 wins", () => {
  expect(ssTestQuery("?ss_test=1")).toBe("on");
  expect(ssTestQuery("ss_test=1")).toBe("on");
  expect(ssTestQuery("?ofk_test=1")).toBe("on");
  expect(ssTestQuery("?ss_test=0")).toBe("off");
  expect(ssTestQuery("?ss_test=0&ofk_test=1")).toBe("off");
  expect(ssTestQuery("?ofk_test=1&ss_test=0")).toBe("off");
  expect(ssTestQuery("?ss_test=yes")).toBeNull();
  expect(ssTestQuery("")).toBeNull();
});

test("ss_test cookie is scoped to saassuite.ai for 24 hours", () => {
  expect(saasSuiteCookieDomain("saassuite.ai")).toBe(".saassuite.ai");
  expect(saasSuiteCookieDomain("www.saassuite.ai")).toBe(".saassuite.ai");
  expect(saasSuiteCookieDomain("app.saassuite.ai")).toBe(".saassuite.ai");
  expect(saasSuiteCookieDomain("notsaassuite.ai")).toBeNull();
  expect(saasSuiteCookieDomain("evilsaassuite.ai")).toBeNull();
  expect(saasSuiteCookieDomain("onefeaturekit.com")).toBeNull();
  expect(saasSuiteCookieDomain("localhost")).toBeNull();

  const on = ssTestCookieAssignment("www.saassuite.ai", true);
  expect(on).toContain("ss_test=1");
  expect(on).toContain(`Max-Age=${SS_TEST_MAX_AGE_SECONDS}`);
  expect(on).toContain("SameSite=Lax");
  expect(on).toContain("Domain=.saassuite.ai");
  expect(on).toContain("Path=/");

  const off = ssTestCookieAssignment("saassuite.ai", false);
  expect(off).toContain("Max-Age=0");
  expect(off).toContain("Domain=.saassuite.ai");
  expect(ssTestCookieAssignment("onefeaturekit.com", true)).not.toContain("Domain=");
});

test("isTestTraffic sticks in localStorage, the cookie, and window.__ssTest", () => {
  const browser = installBrowser("?ss_test=1", "saassuite.ai");
  try {
    expect(isTestTraffic()).toBe(true);
    expect(browser.win.__ssTest).toBe(true);
    expect(browser.win.localStorage.getItem(SS_TEST_STORAGE_KEY)).toBe("1");
    expect(browser.win.document.cookie).toContain("ss_test=1");
    expect(browser.win.document.cookie).toContain("Domain=.saassuite.ai");

    browser.location.search = "";
    expect(isTestTraffic()).toBe(true);

    browser.location.search = "?ss_test=0";
    expect(isTestTraffic()).toBe(false);
    expect(browser.win.__ssTest).toBe(false);
    expect(browser.win.localStorage.getItem(SS_TEST_STORAGE_KEY)).toBeNull();
    expect(browser.win.document.cookie).not.toContain("ss_test=1");
  } finally {
    browser.restore();
  }
});

test("ofk_test=1 sets the sticky ss_test flag and ss_test=0 clears the kit session", () => {
  const browser = installBrowser("?ofk_test=1");
  try {
    expect(isTestTraffic()).toBe(true);
    expect(browser.win.localStorage.getItem(SS_TEST_STORAGE_KEY)).toBe("1");
    const session = touchKitSession(1_700_000_000_000);
    expect(session?.test).toBe(true);

    browser.location.search = "?ss_test=0";
    const cleared = touchKitSession(1_700_000_000_001);
    expect(cleared?.id).toBe(session?.id);
    expect(cleared?.test).toBe(false);
    expect(isTestTraffic()).toBe(false);
  } finally {
    browser.restore();
  }
});

test("Stape collect is skipped while the sticky flag is on", () => {
  const browser = installBrowser("", "saassuite.ai");
  try {
    browser.win.localStorage.setItem(SS_TEST_STORAGE_KEY, "1");
    expect(buildStapeCollectUrl("page_view", "PageView", "pv_1")).toBe("");
  } finally {
    browser.restore();
  }
});

test("server test flag skips CAPI unless a test event code is set", () => {
  expect(metaSendPlan(false, null)).toEqual({ send: true });
  expect(metaSendPlan(true, null)).toEqual({ send: false });
  expect(metaSendPlan(true, "TEST123")).toEqual({ send: true, testEventCode: "TEST123" });
  expect(requestIsTest({ body: { is_test: true } })).toBe(true);
  expect(requestIsTest({ body: { tracking: { is_test: "1" } } })).toBe(true);
  expect(requestIsTest({ cookieHeader: "theme=dark; ss_test=1" })).toBe(true);
  expect(requestIsTest({ metadata: { is_test: "true" } })).toBe(true);
  expect(requestIsTest({ body: { is_test: false }, cookieHeader: "ss_test=0" })).toBe(false);
  expect(missingIsTestColumn({ code: "PGRST204", message: "is_test" })).toBe(true);
  expect(missingIsTestColumn({ message: "column missing" })).toBe(false);
});

test("kit checkout and Stripe metadata treat is_test as test traffic", () => {
  expect(kitCheckoutStartedSkipReason({
    livemode: true,
    email: "qa@example.com",
    promotionCode: null,
    isTest: true,
  })).toBe("test-traffic");

  const meta = kitStripeTrackingMetadata({
    tracking: { is_test: true, fbp: "fb.1.1.1" },
  });
  expect(meta.is_test).toBe("true");
  expect(meta.fbp).toBe("fb.1.1.1");

  expect(kitStripeTrackingMetadata({
    tracking: { tracking_optout: true, is_test: true, fbp: "fb.1.1.1" },
  })).toEqual({ tracking_optout: "true", is_test: "true" });
});

test("the head script sets the flag before pixels and GTM", () => {
  const html = readFileSync("index.html", "utf8");
  const flagAt = html.indexOf('var KEY = "ss_test"');
  const optoutAt = html.indexOf("ss_tracking_optout");
  const gtmAt = html.indexOf("GTM-M7B83SRK");
  expect(flagAt).toBeGreaterThan(-1);
  expect(flagAt).toBeLessThan(optoutAt);
  expect(html.indexOf('traffic_type: "internal"')).toBeGreaterThan(flagAt);
  expect(html.indexOf('traffic_type: "internal"')).toBeLessThan(gtmAt);
  expect(html).toContain("!window.__ssTest");
  expect(html).toContain("ofk_test");
  expect(html).toContain('host.slice(-13) === ".saassuite.ai"');

  const tracking = readFileSync("src/funnel/one-feature-kit/tracking.ts", "utf8");
  expect(tracking).toContain("trackingPixelsAllowed()");
});
