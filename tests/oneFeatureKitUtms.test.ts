import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { kitUtmFields, kitUtmMetadata } from "../supabase/functions/_shared/kit-meta";
import { kitPurchasedPayload } from "../supabase/functions/_shared/kit-lynkific";
import {
  KIT_UTM_FIRST_TOUCH_KEY,
  captureKitFirstTouchUtms,
  fbclidFromFbc,
  kitCapiCanSend,
  kitCheckoutUtms,
  trackKitStepView,
  waitForKitCapiMatch,
} from "../src/funnel/one-feature-kit/tracking";
import { buildStapeCollectUrl, readGaClientId, registrableDomain } from "../src/funnel/one-feature-kit/stapeCollect";

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

test("contact UTMs are trimmed, capped, and empty when unknown", () => {
  expect(kitUtmFields(null)).toEqual({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
  });
  expect(kitUtmFields({
    utm_source: "  facebook  ",
    utm_medium: "paid",
    utm_campaign: ` ${"k".repeat(250)} `,
    utm_content: 12,
  })).toEqual({
    utm_source: "facebook",
    utm_medium: "paid",
    utm_campaign: "k".repeat(200),
    utm_content: "",
  });
  expect(kitUtmMetadata(kitUtmFields({
    utm_source: " facebook ",
    utm_medium: "   ",
    utm_campaign: "one-feature-kit",
    utm_content: "",
  }))).toEqual({
    utm_source: "facebook",
    utm_campaign: "one-feature-kit",
  });

  const purchased = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "+13375551212",
    name: "Ada Lovelace",
    lineIds: ["kit", "bump-replay"],
    amountCentsTotal: 4400,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_a1b2c3",
    loginUrl: "https://auth.example/verify?token=1",
    purchasedAt: "2026-10-21T13:15:00.000Z",
    ...kitUtmFields({
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "one-feature-kit",
      utm_content: "video-ad",
    }),
  });
  expect(purchased).toMatchObject({
    event: "saassuite.kit_purchased",
    utm_source: "facebook",
    utm_medium: "paid",
    utm_campaign: "one-feature-kit",
    utm_content: "video-ad",
  });
  const parsed = JSON.parse(JSON.stringify(purchased)) as typeof purchased;
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const) {
    expect(typeof parsed[key]).toBe("string");
    expect(parsed[key]).not.toBeNull();
  }
  expect(parsed.utm_source).toBe("facebook");
});

test("the kit funnel stores the first campaign and sends it on create", () => {
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
    document: globalThis.document,
  };
  const session = memoryStorage();
  const local = memoryStorage();
  const location = {
    search: "?utm_source=%20facebook%20&utm_medium=paid&utm_campaign=one-feature-kit&utm_content=video-ad&utm_term=ignored",
    origin: "https://saassuite.ai",
    pathname: "/one-feature-kit",
    href: "https://saassuite.ai/one-feature-kit",
    hostname: "localhost",
  };
  Object.assign(globalThis, {
    window: { location, sessionStorage: session, localStorage: local },
    sessionStorage: session,
    localStorage: local,
    document: { referrer: "", cookie: "" },
  });
  try {
    trackKitStepView("/one-feature-kit");
    expect(kitCheckoutUtms()).toEqual({
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "one-feature-kit",
      utm_content: "video-ad",
    });
    expect(JSON.parse(session.data.get(KIT_UTM_FIRST_TOUCH_KEY) ?? "{}")).toEqual({
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "one-feature-kit",
      utm_content: "video-ad",
    });
    expect(local.data.get(KIT_UTM_FIRST_TOUCH_KEY)).toBe(session.data.get(KIT_UTM_FIRST_TOUCH_KEY));

    location.search = "?utm_source=email&utm_medium=newsletter&utm_campaign=later&utm_content=footer";
    expect(captureKitFirstTouchUtms().utm_source).toBe("facebook");
    expect(captureKitFirstTouchUtms().utm_campaign).toBe("one-feature-kit");

    session.clear();
    local.clear();
    document.cookie = "";
    location.search = "";
    local.setItem("utm_attribution", JSON.stringify({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "brand",
      utm_content: "headline",
    }));
    expect(captureKitFirstTouchUtms()).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "brand",
      utm_content: "headline",
    });

    session.clear();
    local.clear();
    document.cookie = "";
    session.setItem(KIT_UTM_FIRST_TOUCH_KEY, JSON.stringify({
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_content: "",
    }));
    location.search = "?utm_source=email&utm_medium=newsletter";
    expect(captureKitFirstTouchUtms()).toMatchObject({
      utm_source: "email",
      utm_medium: "newsletter",
      utm_campaign: "",
      utm_content: "",
    });

    const payment = readFileSync("src/funnel/one-feature-kit/payment.ts", "utf8");
    expect(payment).toContain("const utm = kitCheckoutUtms()");
    expect(payment).toContain("utm_source: utm.utm_source");
    expect(payment).toContain("utm_medium: utm.utm_medium");
    expect(payment).toContain("utm_campaign: utm.utm_campaign");
    expect(payment).toContain("utm_content: utm.utm_content");
    expect(payment).toContain("tracking: { ...kitBrowserTracking(), ...utm }");
    const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
    expect(webhook).toContain("...kitUtmFields(checkout.metadata)");
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("the Stape collect hit carries cid on the query string and reuses _ga", () => {
  expect(registrableDomain("www.saassuite.ai")).toBe("saassuite.ai");
  expect(registrableDomain("onefeaturekit.com")).toBe("onefeaturekit.com");
  expect(registrableDomain("localhost")).toBeNull();
  expect(readGaClientId("_ga=GA1.1.111.222; _ga_UEFEWR349R8=GS1.1.1")).toBe("111.222");
  expect(readGaClientId("other=1")).toBeNull();

  const jar = new Map<string, string>();
  let lastAssignment = "";
  const session = memoryStorage();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    sessionStorage: globalThis.sessionStorage,
    screen: globalThis.screen,
  };
  const location = {
    href: "https://www.saassuite.ai/one-feature-kit?utm_source=facebook&utm_medium=paid&utm_campaign=kit&utm_content=video&utm_term=ghl&fbclid=click-1",
    search: "?utm_source=facebook&utm_medium=paid&utm_campaign=kit&utm_content=video&utm_term=ghl&fbclid=click-1",
    hostname: "www.saassuite.ai",
    protocol: "https:",
  };
  const documentMock = {
    referrer: "https://facebook.com/",
    title: "One Feature Kit",
    get cookie() {
      return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    },
    set cookie(value: string) {
      lastAssignment = value;
      const pair = value.split(";")[0];
      const eq = pair.indexOf("=");
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    },
  };
  Object.assign(globalThis, {
    window: {
      location,
      sessionStorage: session,
      document: documentMock,
      navigator: { language: "en-US" },
      screen: { width: 412, height: 823 },
    },
    sessionStorage: session,
    navigator: { language: "en-US", sendBeacon: () => true },
    screen: { width: 412, height: 823 },
    document: documentMock,
  });
  try {
    const pageView = new URL(buildStapeCollectUrl("page_view", "PageView", "pv_abc"));
    const query = pageView.searchParams;
    expect(pageView.origin + pageView.pathname).toBe("https://xyaheorc.usw.stape.io/g/collect");
    expect(query.get("v")).toBe("2");
    expect(query.get("tid")).toBe("G-UEFEWR349R8");
    expect(query.get("cid")).toMatch(/^\d+\.\d+$/);
    expect(query.get("sid")).toMatch(/^\d+$/);
    expect(query.get("_s")).toBe("1");
    expect(query.get("seg")).toBe("0");
    expect(query.get("en")).toBe("page_view");
    expect(query.get("ep.event_id")).toBe("pv_abc");
    expect(query.get("ep.event_name")).toBe("PageView");
    expect(query.get("dl")).toBe(location.href);
    expect(query.get("dr")).toBe("https://facebook.com/");
    expect(query.get("dt")).toBe("One Feature Kit");
    expect(query.get("ul")).toBe("en-us");
    expect(query.get("sr")).toBe("412x823");
    expect(query.get("cs")).toBe("facebook");
    expect(query.get("cm")).toBe("paid");
    expect(query.get("cn")).toBe("kit");
    expect(query.get("cc")).toBe("video");
    expect(query.get("ck")).toBe("ghl");
    expect(query.get("ep.fbclid")).toBe("click-1");
    expect(lastAssignment).toContain("Domain=.saassuite.ai");
    expect(lastAssignment).toContain("Path=/");
    expect(lastAssignment).toContain("Max-Age=63072000");
    expect(lastAssignment.startsWith(`_ga=GA1.1.${query.get("cid")}`)).toBe(true);

    const again = new URL(buildStapeCollectUrl("view_item", "ViewContent", "vc_abc", { value: 27, currency: "USD" }));
    expect(again.searchParams.get("cid")).toBe(query.get("cid"));
    expect(again.searchParams.get("sid")).toBe(query.get("sid"));
    expect(again.searchParams.get("_s")).toBe("2");
    expect(again.searchParams.get("en")).toBe("view_item");
    expect(again.searchParams.get("ep.event_id")).toBe("vc_abc");
    expect(again.searchParams.get("epn.value")).toBe("27");
    expect(again.searchParams.get("ep.currency")).toBe("USD");
    expect(lastAssignment.startsWith(`_ga=GA1.1.${query.get("cid")}`)).toBe(true);
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("a cold kit visit waits for _fbp and skips the server event when none appears", async () => {
  expect(kitCapiCanSend({})).toBe(false);
  expect(kitCapiCanSend({ email: "a@b.co" })).toBe(true);
  expect(kitCapiCanSend({ fbclid: "IwAR" })).toBe(true);
  expect(kitCapiCanSend({ fbp: "fb.1.1.9" })).toBe(true);
  expect(kitCapiCanSend({ fbc: "fb.1.10.click-id" })).toBe(true);
  expect(fbclidFromFbc("fb.1.10.click-id")).toBe("click-id");
  expect(fbclidFromFbc("not-an-fbc")).toBeUndefined();

  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
    document: globalThis.document,
  };
  const session = memoryStorage();
  const local = memoryStorage();
  let cookie = "";
  const location = {
    search: "",
    href: "https://saassuite.ai/one-feature-kit",
    hostname: "saassuite.ai",
    origin: "https://saassuite.ai",
    pathname: "/one-feature-kit",
  };
  Object.assign(globalThis, {
    window: { location, sessionStorage: session, localStorage: local },
    sessionStorage: session,
    localStorage: local,
    document: {
      referrer: "",
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        cookie = value;
      },
    },
  });
  try {
    const started = Date.now();
    expect(await waitForKitCapiMatch(180)).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);

    cookie = "_fbp=fb.1.99.555";
    const found = await waitForKitCapiMatch(400);
    expect(found?.fbp).toBe("fb.1.99.555");

    const tracking = readFileSync("src/funnel/one-feature-kit/tracking.ts", "utf8");
    const pixelAt = tracking.indexOf('pixel("PageView"');
    const waitAt = tracking.indexOf("waitForKitCapiMatch()");
    expect(pixelAt).toBeGreaterThan(-1);
    expect(waitAt).toBeGreaterThan(pixelAt);
    expect(tracking.indexOf('pixel("ViewContent"')).toBeGreaterThan(pixelAt);
    expect(tracking.indexOf('pixel("ViewContent"')).toBeLessThan(waitAt);
    const stapeAt = tracking.indexOf('sendStapeEvent("page_view", "PageView", pageViewId)');
    expect(stapeAt).toBeGreaterThan(pixelAt);
    expect(stapeAt).toBeLessThan(waitAt);
    expect(tracking.indexOf('sendStapeEvent("view_item", "ViewContent", viewId')).toBeGreaterThan(stapeAt);
    expect(tracking).toContain("navigator.sendBeacon(url)");
    expect(tracking).not.toContain("new Blob([payload]");
    const stape = readFileSync("src/funnel/one-feature-kit/stapeCollect.ts", "utf8");
    expect(stape).toContain("https://xyaheorc.usw.stape.io/g/collect");
    expect(stape).toContain("G-UEFEWR349R8");
  } finally {
    Object.assign(globalThis, previous);
  }
});
