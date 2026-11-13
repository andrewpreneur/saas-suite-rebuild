import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { kitMetaUserData, kitStripeTrackingMetadata } from "../supabase/functions/_shared/kit-meta";
import { kitBuyerAttributionPatch } from "../supabase/functions/_shared/saas-user-write";
import { supabase } from "@/integrations/supabase/client";
import { createKitCheckout } from "@/funnel/one-feature-kit/payment";
import { handleFunnelClick } from "@/funnel/one-feature-kit/wire";
import { loadDraft } from "@/funnel/one-feature-kit/order";
import {
  KIT_ATTR_COOKIE,
  KIT_ATTR_STORAGE_KEY,
  captureKitAttribution,
  kitAttributionCookieAssignment,
  kitAttributionCookieDomain,
  resolveKitAttribution,
  type KitAttributionSources,
} from "../src/funnel/one-feature-kit/attribution";
import { kitBrowserTracking } from "../src/funnel/one-feature-kit/tracking";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  };
}

function sources(over: Partial<KitAttributionSources> = {}): KitAttributionSources {
  return {
    search: "",
    pageUrl: "https://saassuite.ai/one-feature-kit",
    referrer: "",
    sessionRaw: null,
    localRaw: null,
    cookieHeader: "",
    legacySessionRaw: null,
    legacyLocalRaw: null,
    siteRaw: null,
    legacyFbclid: null,
    legacyFbc: null,
    legacyFbp: null,
    nowMs: 1_700_000_000_000,
    ...over,
  };
}

test("a blank field falls through the URL, then sessionStorage, localStorage, and the cookie", () => {
  expect(kitAttributionCookieDomain("www.saassuite.ai")).toBe(".saassuite.ai");
  expect(kitAttributionCookieDomain("saassuite.ai")).toBe(".saassuite.ai");
  expect(kitAttributionCookieDomain("onefeaturekit.com")).toBe(".onefeaturekit.com");
  expect(kitAttributionCookieDomain("localhost")).toBeNull();
  const assignment = kitAttributionCookieAssignment('{"utm_source":"facebook"}', "www.saassuite.ai", true);
  expect(assignment).toContain(`${KIT_ATTR_COOKIE}=`);
  expect(assignment).toContain("Domain=.saassuite.ai");
  expect(assignment).toContain("SameSite=Lax");
  expect(assignment).toContain("Path=/");
  expect(assignment).toContain("Secure");

  const fromUrl = resolveKitAttribution(sources({
    search: "?fbclid=test&utm_source=facebook&utm_id=ad-9",
    pageUrl: "https://saassuite.ai/one-feature-kit?fbclid=test&utm_source=facebook&utm_id=ad-9",
    referrer: "https://facebook.com/",
  }));
  expect(fromUrl.utm_source).toBe("facebook");
  expect(fromUrl.fbclid).toBe("test");
  expect(fromUrl.utm_id).toBe("ad-9");
  expect(fromUrl.fbc).toBe("fb.1.1700000000000.test");
  expect(fromUrl.landing_page).toContain("fbclid=test");
  expect(fromUrl.referrer).toBe("https://facebook.com/");

  const sessionWins = resolveKitAttribution(sources({
    search: "?utm_source=email",
    sessionRaw: JSON.stringify({ utm_source: "facebook" }),
    localRaw: JSON.stringify({ utm_source: "google" }),
    cookieHeader: `${KIT_ATTR_COOKIE}=${encodeURIComponent(JSON.stringify({ utm_source: "bing" }))}`,
  }));
  expect(sessionWins.utm_source).toBe("facebook");

  const localWins = resolveKitAttribution(sources({
    localRaw: JSON.stringify({ utm_source: "google" }),
    cookieHeader: `${KIT_ATTR_COOKIE}=${encodeURIComponent(JSON.stringify({ utm_source: "bing" }))}`,
  }));
  expect(localWins.utm_source).toBe("google");

  const cookieWins = resolveKitAttribution(sources({
    cookieHeader: `${KIT_ATTR_COOKIE}=${encodeURIComponent(JSON.stringify({ utm_source: "facebook", fbclid: "test" }))}`,
  }));
  expect(cookieWins.utm_source).toBe("facebook");
  expect(cookieWins.fbclid).toBe("test");
  expect(cookieWins.fbc).toBe("fb.1.1700000000000.test");
});

test("_fbc is kept, and a missing fbc is built once from fbclid", () => {
  const fromCookie = resolveKitAttribution(sources({
    search: "?fbclid=test",
    cookieHeader: "_fbc=fb.1.5.test; _fbp=fb.1.9.555",
  }));
  expect(fromCookie.fbc).toBe("fb.1.5.test");
  expect(fromCookie.fbp).toBe("fb.1.9.555");

  const storedFbc = resolveKitAttribution(sources({
    search: "?fbclid=test",
    sessionRaw: JSON.stringify({ fbc: "fb.1.5.test", fbclid: "test" }),
    cookieHeader: "_fbc=fb.1.99.later; _fbp=fb.1.8.live",
  }));
  expect(storedFbc.fbc).toBe("fb.1.5.test");
  expect(storedFbc.fbp).toBe("fb.1.8.live");
});

test("landing params survive checkout and the webhook user patch, and existing values stay", () => {
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
    document: globalThis.document,
  };
  const session = memoryStorage();
  const local = memoryStorage();
  const jar = new Map<string, string>();
  const location = {
    search: "?fbclid=test&utm_source=facebook&utm_medium=paid&utm_campaign=kit&utm_content=video&utm_term=ghl&utm_id=ad-9",
    origin: "https://saassuite.ai",
    pathname: "/one-feature-kit",
    href: "https://saassuite.ai/one-feature-kit?fbclid=test&utm_source=facebook",
    hostname: "saassuite.ai",
    protocol: "https:",
  };
  const documentMock = {
    referrer: "https://facebook.com/",
    get cookie() {
      return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    },
    set cookie(value: string) {
      const pair = value.split(";")[0];
      const eq = pair.indexOf("=");
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    },
  };
  Object.assign(globalThis, {
    window: { location, sessionStorage: session, localStorage: local },
    sessionStorage: session,
    localStorage: local,
    document: documentMock,
  });
  try {
    const landed = captureKitAttribution(1_700_000_000_000);
    expect(landed.fbc).toBe("fb.1.1700000000000.test");
    expect(session.data.get(KIT_ATTR_STORAGE_KEY)).toBeTruthy();
    expect(local.data.get(KIT_ATTR_STORAGE_KEY)).toBe(session.data.get(KIT_ATTR_STORAGE_KEY));
    expect(jar.has(KIT_ATTR_COOKIE)).toBe(true);
    expect([...jar.keys()].join(" ")).not.toContain("Path");

    session.clear();
    local.clear();
    location.search = "";
    location.pathname = "/one-feature-kit/checkout";
    location.href = "https://saassuite.ai/one-feature-kit/checkout";
    documentMock.referrer = "https://saassuite.ai/one-feature-kit";
    const checkout = captureKitAttribution(1_700_000_999_999);
    expect(checkout.fbclid).toBe("test");
    expect(checkout.utm_source).toBe("facebook");
    expect(checkout.utm_medium).toBe("paid");
    expect(checkout.utm_id).toBe("ad-9");
    expect(checkout.fbc).toBe(landed.fbc);
    expect(checkout.landing_page).toContain("/one-feature-kit");
    expect(checkout.landing_page).toContain("fbclid=test");
    expect(checkout.referrer).toBe("https://facebook.com/");

    const tracking = kitBrowserTracking();
    expect(tracking.fbclid).toBe("test");
    expect(tracking.fbc).toBe(landed.fbc);
    expect(tracking.utm_source).toBe("facebook");
    expect(tracking.checkout_page).toBe("/one-feature-kit/checkout");

    const meta = kitStripeTrackingMetadata({ tracking, nowMs: 1_700_000_999_999 });
    expect(meta.fbc).toBe(landed.fbc);
    expect(meta.fbclid).toBe("test");
    expect(meta.utm_source).toBe("facebook");
    expect(meta.utm_id).toBe("ad-9");
    expect(meta.landing_page).toContain("fbclid=test");
    expect(meta.referrer).toBe("https://facebook.com/");
    expect(meta.checkout_page).toBe("/one-feature-kit/checkout");
    const purchaseUser = kitMetaUserData(meta);
    expect(purchaseUser.fbc).toBe(meta.fbc);
    expect(purchaseUser.fbp).toBe(meta.fbp ?? null);
    expect(purchaseUser.fbclid).toBe("test");

    const created = kitBuyerAttributionPatch({
      existing: {},
      metadata: meta,
      name: "",
      nowIso: "2026-10-23T05:48:00.000Z",
    });
    expect(created).toMatchObject({
      fbclid: "test",
      fbc: landed.fbc,
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "kit",
      utm_content: "video",
      utm_term: "ghl",
      utm_id: "ad-9",
      referrer: "https://facebook.com/",
      checkout_page: "/one-feature-kit/checkout",
    });
    expect(created.landing_page).toContain("fbclid=test");
    for (const blocked of ["plan", "approval", "trial_source", "premium_support", "agency_id", "max_onboarding_users"]) {
      expect(created).not.toHaveProperty(blocked);
    }

    const kept = kitBuyerAttributionPatch({
      existing: { utm_source: "google", fbclid: "already", fbc: "fb.1.1.kept", referrer: "https://instagram.com/" },
      metadata: { ...meta, utm_source: "facebook", fbclid: "test", fbc: landed.fbc, referrer: "https://facebook.com/", plan: "ADVANCED" },
      name: "",
      nowIso: "2026-10-23T05:48:00.000Z",
    });
    expect(kept.utm_source).toBeUndefined();
    expect(kept.fbclid).toBeUndefined();
    expect(kept.fbc).toBeUndefined();
    expect(kept.referrer).toBeUndefined();
    expect(kept.utm_medium).toBe("paid");
    expect(kept).not.toHaveProperty("plan");

    const whitespace = kitBuyerAttributionPatch({
      existing: { utm_source: "   ", fbclid: "" },
      metadata: meta,
      name: "",
      nowIso: "2026-10-23T05:48:00.000Z",
    });
    expect(whitespace.utm_source).toBe("facebook");
    expect(whitespace.fbclid).toBe("test");

    const pageFallback = kitBuyerAttributionPatch({
      existing: {},
      metadata: { page_url: "https://saassuite.ai/one-feature-kit/checkout" },
      name: "",
      nowIso: "2026-10-23T05:48:00.000Z",
    });
    expect(pageFallback.checkout_page).toBe("https://saassuite.ai/one-feature-kit/checkout");

    const synthesized = kitStripeTrackingMetadata({ tracking: { fbclid: "test" }, nowMs: 111 });
    expect(synthesized.fbc).toBe("fb.1.111.test");
    expect(kitMetaUserData(synthesized).fbc).toBe("fb.1.111.test");
    expect(kitStripeTrackingMetadata({
      tracking: { tracking_optout: true, fbclid: "test" },
      nowMs: 111,
    })).toEqual({ tracking_optout: "true" });

    const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
    const sender = readFileSync("supabase/functions/_shared/kit-purchase-send.ts", "utf8");
    const sendAt = sender.indexOf("sendMeta: () => sendMetaPurchase({");
    const sendBody = sender.slice(sendAt, sendAt + 800);
    expect(webhook).toContain("sendKitRoutedPurchase");
    expect(sendBody).toContain("fbc: input.user.fbc");
    expect(sendBody).toContain("fbp: input.user.fbp");
    const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
    expect(payment).toContain("utm_id: utmField");
    expect(payment).toContain("checkout_page:");
    expect(payment).toContain("site_session_id: siteSessionId");
    expect(payment).toContain("kitStripeTrackingMetadata");
    const buyer = readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8");
    expect(buyer).not.toContain("copyKitCheckoutAttribution");
    expect(buyer).not.toContain("kit-checkout-attribution");
    const patchAt = buyer.indexOf("kitBuyerAttributionPatch");
    const grantAt = buyer.indexOf("await grantKitBasicAccess", patchAt);
    expect(patchAt).toBeGreaterThan(-1);
    expect(grantAt).toBeGreaterThan(patchAt);
    expect(buyer).toContain("ensureStarter: (buyerEmail, context) => settleBuyer");
    expect(buyer).toContain('if (result.duplicate || result.skipped === "in progress") await settleBuyer');
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("checkout posts cookie attribution when sessionStorage.setItem throws", async () => {
  const payload = JSON.stringify({
    fbclid: "test",
    fbc: "fb.1.1.test",
    fbp: "fb.1.9.555",
    utm_source: "facebook",
    utm_medium: "paid",
    landing_page: "https://saassuite.ai/one-feature-kit?fbclid=test&utm_source=facebook",
    referrer: "https://facebook.com/",
  });
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
    document: globalThis.document,
  };
  const blocked = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("QuotaExceededError");
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
  const location = {
    search: "",
    origin: "https://saassuite.ai",
    pathname: "/one-feature-kit/checkout",
    href: "https://saassuite.ai/one-feature-kit/checkout",
    hostname: "saassuite.ai",
    protocol: "https:",
  };
  Object.assign(globalThis, {
    window: { location, sessionStorage: blocked, localStorage: blocked },
    sessionStorage: blocked,
    localStorage: blocked,
    document: { referrer: "", cookie: `${KIT_ATTR_COOKIE}=${encodeURIComponent(payload)}` },
  });
  const functionsProto = Object.getPrototypeOf(supabase.functions);
  const invoke = functionsProto.invoke;
  const fetchImpl = globalThis.fetch;
  let body: Record<string, unknown> | null = null;
  functionsProto.invoke = async (_name: string, options?: { body?: Record<string, unknown> }) => {
    body = options?.body ?? null;
    return { data: { clientSecret: "cs_test_secret_blocked", sessionId: "cs_live_blocked" }, error: null };
  };
  globalThis.fetch = (async () => {
    throw new Error("checkout test must not call the network");
  }) as typeof fetch;
  try {
    const started = await createKitCheckout(
      { firstName: "Ada", email: "ada@example.com", phone: "5551234567" },
      { replay: false, video: false, install: false },
    );
    expect(started.sessionId).toBe("cs_live_blocked");
    expect(started.clientSecret).toContain("_secret_");
    expect(body?.action).toBe("create");
    const tracking = body?.tracking as Record<string, string>;
    expect(tracking.fbclid).toBe("test");
    expect(tracking.fbc).toBe("fb.1.1.test");
    expect(tracking.fbp).toBe("fb.1.9.555");
    expect(tracking.utm_source).toBe("facebook");
    expect(tracking.referrer).toBe("https://facebook.com/");
    expect(tracking.landing_page).toContain("fbclid=test");
    expect(body?.utm_source).toBe("facebook");
    expect(body?.utm_medium).toBe("paid");
  } finally {
    functionsProto.invoke = invoke;
    globalThis.fetch = fetchImpl;
    Object.assign(globalThis, previous);
  }
});

test("pay click posts cookie attribution when sessionStorage and localStorage throw", async () => {
  const payload = JSON.stringify({
    fbclid: "pay-click",
    fbc: "fb.1.42.pay-click",
    fbp: "fb.1.9.777",
    utm_source: "facebook",
    utm_medium: "paid",
    landing_page: "https://saassuite.ai/one-feature-kit?fbclid=pay-click&utm_source=facebook",
    referrer: "https://facebook.com/",
  });
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
    document: globalThis.document,
  };
  const deny = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  const blocked = {
    getItem: deny,
    setItem: deny,
    removeItem: deny,
    clear: deny,
    key: () => {
      deny();
      return null;
    },
    length: 0,
  };
  type FakeEl = {
    id: string;
    className: string;
    textContent: string;
    value: string;
    dataset: Record<string, string>;
    isConnected: boolean;
    parentElement: FakeEl | null;
    children: FakeEl[];
    attrs: Map<string, string>;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    closest(selector: string): FakeEl | null;
    querySelector(selector: string): FakeEl | null;
    querySelectorAll(selector: string): FakeEl[];
    before(node: FakeEl): void;
    remove(): void;
    append(node: FakeEl): void;
  };
  const matches = (el: FakeEl, selector: string): boolean => {
    if (selector.includes(",")) return selector.split(",").some((part) => matches(el, part.trim()));
    const simple = selector.split(/\s+/).pop() ?? selector;
    if (simple.startsWith("#")) {
      const [id, className] = simple.slice(1).split(".");
      if (el.id !== id) return false;
      if (className && !el.className.split(/\s+/).includes(className)) return false;
      return true;
    }
    if (simple.startsWith(".")) return el.className.split(/\s+/).includes(simple.slice(1));
    if (simple.startsWith("[") && simple.endsWith("]")) return el.attrs.has(simple.slice(1, -1));
    return false;
  };
  const walk = (el: FakeEl): FakeEl[] => [el, ...el.children.flatMap(walk)];
  const createEl = (id = ""): FakeEl => {
    const el: FakeEl = {
      id,
      className: "",
      textContent: "",
      value: "",
      dataset: {},
      isConnected: true,
      parentElement: null,
      children: [],
      attrs: new Map(),
      setAttribute(name, value) {
        el.attrs.set(name, value);
      },
      removeAttribute(name) {
        el.attrs.delete(name);
      },
      closest(selector) {
        let current: FakeEl | null = el;
        while (current) {
          if (matches(current, selector)) return current;
          current = current.parentElement;
        }
        return null;
      },
      querySelector(selector) {
        return walk(el).find((node) => matches(node, selector)) ?? null;
      },
      querySelectorAll(selector) {
        return walk(el).filter((node) => matches(node, selector));
      },
      before(node) {
        const parent = el.parentElement;
        if (!parent) return;
        const index = parent.children.indexOf(el);
        parent.children.splice(index, 0, node);
        node.parentElement = parent;
      },
      remove() {
        const parent = el.parentElement;
        if (!parent) return;
        parent.children = parent.children.filter((child) => child !== el);
        el.parentElement = null;
      },
      append(node) {
        node.parentElement = el;
        el.children.push(node);
      },
    };
    return el;
  };
  const root = createEl("ofk-root");
  const name = createEl("ofk-name");
  name.value = "Ada";
  const email = createEl("ofk-email");
  email.value = "ada@example.com";
  const phone = createEl("ofk-phone");
  phone.value = "5551234567";
  const button = createEl("ofk-complete");
  root.append(name);
  root.append(email);
  root.append(phone);
  root.append(button);
  const location = {
    search: "",
    origin: "http://127.0.0.1:8080",
    pathname: "/one-feature-kit/checkout",
    href: "http://127.0.0.1:8080/one-feature-kit/checkout",
    hostname: "127.0.0.1",
    protocol: "http:",
  };
  Object.assign(globalThis, {
    window: { location, sessionStorage: blocked, localStorage: blocked },
    sessionStorage: blocked,
    localStorage: blocked,
    document: {
      referrer: "",
      cookie: `${KIT_ATTR_COOKIE}=${encodeURIComponent(payload)}`,
      createElement: () => createEl(),
    },
  });
  const functionsProto = Object.getPrototypeOf(supabase.functions);
  const invoke = functionsProto.invoke;
  const fetchImpl = globalThis.fetch;
  const posts: Record<string, unknown>[] = [];
  functionsProto.invoke = async (name: string, options?: { body?: Record<string, unknown> }) => {
    if (name !== "one-feature-kit-payment") throw new Error(`unexpected function ${name}`);
    posts.push(options?.body ?? {});
    return {
      data: {
        clientSecret: "cs_test_secret_stub",
        sessionId: "cs_live_stub",
        leadEventId: "",
        initiateCheckoutEventId: "",
      },
      error: null,
    };
  };
  globalThis.fetch = (async () => {
    throw new Error("checkout test must not call the network");
  }) as typeof fetch;
  try {
    handleFunnelClick(
      root as unknown as HTMLElement,
      "/one-feature-kit/checkout",
      { target: button, preventDefault() {} } as never,
      (() => undefined) as never,
    );
    // The POST already ran. Disconnect before the promise settles so the stub does not open Stripe.js.
    button.isConnected = false;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(loadDraft().contact.email).toBe("ada@example.com");
    expect(posts).toHaveLength(1);
    const body = posts[0];
    expect(body.action).toBe("create");
    const tracking = body.tracking as Record<string, string>;
    expect(tracking.fbclid).toBe("pay-click");
    expect(tracking.fbc).toBe("fb.1.42.pay-click");
    expect(tracking.fbp).toBe("fb.1.9.777");
    expect(tracking.utm_source).toBe("facebook");
    expect(tracking.utm_medium).toBe("paid");
    expect(tracking.landing_page).toContain("fbclid=pay-click");
    expect(tracking.referrer).toBe("https://facebook.com/");
    expect(tracking.checkout_page).toBe("/one-feature-kit/checkout");
    expect(body.utm_source).toBe("facebook");
    expect(body.utm_medium).toBe("paid");
  } finally {
    functionsProto.invoke = invoke;
    globalThis.fetch = fetchImpl;
    Object.assign(globalThis, previous);
    if (previous.sessionStorage === undefined) Reflect.deleteProperty(globalThis, "sessionStorage");
    if (previous.localStorage === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    if (previous.document === undefined) Reflect.deleteProperty(globalThis, "document");
    if (previous.window === undefined) Reflect.deleteProperty(globalThis, "window");
  }
});
