import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { pixelAllowedHere } from "../src/utils/pixelHost";
import { trackFunnelPageview, trackSiteEvent } from "../src/components/SiteTracker";
import { FUNNEL_ROUTES } from "../src/funnel/one-feature-kit/order";
import { sha256Hex } from "../src/funnel/one-feature-kit/sha256";
import {
  KIT_EVENT_NAV_WAIT_MS,
  buildKitEventRow,
  kitBumpLineChanges,
  kitEventHostSkipped,
  kitEventTrackingOpen,
  kitStepForPath,
  resetKitEventColumnProbe,
  trackKitEvent,
  trackKitEventForNavigation,
} from "../src/funnel/one-feature-kit/events";
import {
  claimKitPageView,
  kitFunnelSessionId,
  kitSessionIsTest,
  markKitCheckoutStart,
  touchKitSession,
} from "../src/funnel/one-feature-kit/session";
import {
  KIT_CLIENT_EVENTS,
  KIT_EVENT_STEPS,
  insertKitPurchaseEvents,
  isKitOfkSessionId,
  kitPurchaseEventRows,
  kitPurchaseSessionId,
  kitPurchaseStep,
} from "../supabase/functions/_shared/kit-events";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
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

type BrowserEnv = {
  hostname?: string;
  search?: string;
  referrer?: string;
  userAgent?: string;
  optedOut?: boolean;
};

function installBrowser(env: BrowserEnv = {}) {
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
    document: globalThis.document,
    navigator: globalThis.navigator,
    fetch: globalThis.fetch,
  };
  const session = memoryStorage();
  const local = memoryStorage();
  if (env.optedOut) local.setItem("ss_tracking_optout", "1");
  const location = {
    search: env.search ?? "",
    origin: "https://onefeaturekit.com",
    pathname: "/",
    href: "https://onefeaturekit.com/",
    hostname: env.hostname ?? "onefeaturekit.com",
  };
  Object.assign(globalThis, {
    window: { location, sessionStorage: session, localStorage: local },
    sessionStorage: session,
    localStorage: local,
    document: { referrer: env.referrer ?? "", cookie: "" },
    navigator: { userAgent: env.userAgent ?? "KitTest/1.0" },
  });
  return {
    session,
    local,
    restore() {
      Object.assign(globalThis, previous);
    },
  };
}

test("step names are the FUNNEL_ROUTES keys", () => {
  expect([...KIT_EVENT_STEPS]).toEqual(Object.keys(FUNNEL_ROUTES));
  for (const step of KIT_EVENT_STEPS) {
    expect(kitStepForPath(FUNNEL_ROUTES[step])).toBe(step);
  }
  expect(kitStepForPath("/one-feature-kit/nope")).toBeNull();
  const sql = readFileSync("supabase/migrations/20261021141735_kit_events.sql", "utf8");
  expect(sql).toContain("step in ('sales','checkout','ghl','launch','webinar','thanks')");
  expect(sql).not.toContain("for select");
  expect(sql).toContain("event <> 'purchase'");
});

test("tracking is skipped for opt-out, localhost, and Lovable previews", () => {
  expect(kitEventHostSkipped("localhost")).toBe(true);
  expect(kitEventHostSkipped("127.0.0.1")).toBe(true);
  expect(kitEventHostSkipped("abc.lovableproject.com")).toBe(true);
  expect(kitEventHostSkipped("preview.lovable.app")).toBe(true);
  expect(kitEventHostSkipped("onefeaturekit.com")).toBe(false);
  expect(kitEventHostSkipped("www.onefeaturekit.com")).toBe(false);
  expect(kitEventHostSkipped("saassuite.ai")).toBe(false);

  const optedOut = installBrowser({ hostname: "onefeaturekit.com", optedOut: true });
  try {
    expect(kitEventTrackingOpen()).toBe(false);
    expect(pixelAllowedHere()).toBe(false);
  } finally {
    optedOut.restore();
  }

  const local = installBrowser({ hostname: "localhost" });
  try {
    expect(kitEventTrackingOpen()).toBe(false);
  } finally {
    local.restore();
  }

  const kitHost = installBrowser({ hostname: "onefeaturekit.com" });
  try {
    expect(kitEventTrackingOpen()).toBe(true);
    expect(pixelAllowedHere()).toBe(false);
  } finally {
    kitHost.restore();
  }
});

test("the browser never sends a purchase event", async () => {
  expect(KIT_CLIENT_EVENTS).not.toContain("purchase");
  const env = installBrowser();
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return new Response("", { status: 201 });
  };
  try {
    expect(await buildKitEventRow("purchase", { step: "checkout", line_id: "kit", amount_cents: 2700 })).toBeNull();
    await trackKitEvent("purchase", { step: "thanks", line_id: "launch", amount_cents: 14700 });
    expect(calls.filter((url) => url.includes("kit_events"))).toEqual([]);
  } finally {
    env.restore();
  }
});

test("the insert payload uses the kit session, UTMs, fbclid, referrer, and user-agent hash", async () => {
  const referrer = `https://facebook.com/${"r".repeat(500)}`;
  const env = installBrowser({
    search: "?utm_source=facebook&utm_medium=paid&utm_campaign=one-feature-kit&utm_content=video&utm_term=ghl&fbclid=click-1",
    referrer,
    userAgent: "KitTest/1.0",
  });
  const calls: Array<{ url: string; body: string; prefer: string }> = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      body: typeof init?.body === "string" ? init.body : "",
      prefer: headers.get("Prefer") ?? "",
    });
    return new Response("", { status: 201 });
  };
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("KitTest/1.0"));
    const uaHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const row = await buildKitEventRow("checkout_start", {
      step: "checkout",
      line_id: "not-a-line",
      amount_cents: 2700,
      checkout_session_id: "cs_live_abc123",
    });
    expect(row).toMatchObject({
      step: "checkout",
      event: "checkout_start",
      line_id: null,
      amount_cents: 2700,
      checkout_session_id: "cs_live_abc123",
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "one-feature-kit",
      utm_content: "video",
      utm_term: "ghl",
      fbclid: "click-1",
      ua_hash: uaHash,
    });
    expect(row?.session_id).toMatch(/^[0-9a-f-]{36}$/);
    const stored = JSON.parse(env.local.data.get("ofk_session") ?? "{}") as { id?: string; test?: boolean };
    expect(stored.id).toBe(row?.session_id);
    expect(stored.test).toBe(false);
    expect(row?.is_test).toBe(false);
    expect(row?.referrer).toHaveLength(500);
    expect(row?.referrer).toBe(referrer.slice(0, 500));
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("created_at");

    const again = await buildKitEventRow("view", { step: "sales" });
    expect(again?.session_id).toBe(row?.session_id);

    const badSession = await buildKitEventRow("view", {
      step: "sales",
      checkout_session_id: "sess_not_stripe",
      amount_cents: -5,
    });
    expect(badSession?.checkout_session_id).toBeNull();
    expect(badSession?.amount_cents).toBeNull();

    await trackKitEvent("view", { step: "sales", line_id: "kit" });
    const sent = calls.find((call) => call.url.includes("/rest/v1/kit_events"));
    expect(sent).toBeTruthy();
    expect(sent?.url).not.toContain("select=");
    expect(sent?.prefer).not.toContain("return=representation");
    const body = JSON.parse(sent?.body ?? "{}") as { event: string; session_id: string; id?: string };
    expect(body.event).toBe("view");
    expect(body.session_id).toBe(row?.session_id);
    expect(body.id).toBeUndefined();
  } finally {
    env.restore();
  }
});

test("select all emits one bump event per line that changed", () => {
  expect(kitBumpLineChanges(
    { replay: false, video: false, install: false },
    { replay: true, video: true, install: true },
  )).toEqual([
    { event: "bump_add", line_id: "bump-replay" },
    { event: "bump_add", line_id: "bump-video" },
    { event: "bump_add", line_id: "bump-install" },
  ]);
  expect(kitBumpLineChanges(
    { replay: true, video: false, install: true },
    { replay: true, video: true, install: true },
  )).toEqual([{ event: "bump_add", line_id: "bump-video" }]);
  expect(kitBumpLineChanges(
    { replay: true, video: true, install: true },
    { replay: false, video: false, install: false },
  )).toEqual([
    { event: "bump_remove", line_id: "bump-replay" },
    { event: "bump_remove", line_id: "bump-video" },
    { event: "bump_remove", line_id: "bump-install" },
  ]);
  expect(kitBumpLineChanges(
    { replay: true, video: false, install: false },
    { replay: false, video: false, install: false },
  )).toEqual([{ event: "bump_remove", line_id: "bump-replay" }]);

  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  expect(wire).toContain("kitBumpLineChanges(before, bumps)");
  expect(wire).toContain('trackKitEventForNavigation("upsell_decline"');
  expect(wire).toContain('step: "thanks"');
  expect(wire).toContain('trackKitEvent("checkout_start"');
  const tracking = readFileSync("src/funnel/one-feature-kit/tracking.ts", "utf8");
  const viewAt = tracking.indexOf('trackKitEvent("view"');
  const gateAt = tracking.indexOf("if (!trackingAllowed())");
  expect(viewAt).toBeGreaterThan(-1);
  expect(viewAt).toBeLessThan(gateAt);
  expect(readFileSync("src/funnel/one-feature-kit/events.ts", "utf8")).not.toContain("pixelAllowedHere");
  expect(readFileSync("src/components/SiteTracker.tsx", "utf8")).not.toContain("kit_events");
});

test("navigation waits at most 300ms and a failed insert does not throw", async () => {
  const env = installBrowser();
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = () => new Promise((resolve) => {
    release = resolve;
  });
  try {
    const started = Date.now();
    await trackKitEventForNavigation("cta_click", { step: "sales", line_id: "kit" });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(KIT_EVENT_NAV_WAIT_MS - 40);
    expect(elapsed).toBeLessThan(KIT_EVENT_NAV_WAIT_MS + 250);
  } finally {
    release?.(new Response("", { status: 201 }));
    env.restore();
  }

  const failing = installBrowser({ search: "?utm_source=email" });
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "nope" }), { status: 400 });
  try {
    await expect(trackKitEvent("view", { step: "sales" })).resolves.toBeUndefined();
  } finally {
    failing.restore();
  }
});

test("purchase rows keep a valid browser session and fall back without failing the webhook", async () => {
  expect(isKitOfkSessionId("short")).toBe(false);
  expect(isKitOfkSessionId("11111111-1111-4111-8111-111111111111")).toBe(true);
  expect(kitPurchaseSessionId("11111111-1111-4111-8111-111111111111", "cs_live_abc")).toBe(
    "11111111-1111-4111-8111-111111111111",
  );
  const longId = `cs_live_${"a".repeat(80)}`;
  const fallback = kitPurchaseSessionId("nope", longId);
  expect(fallback.startsWith("srv_")).toBe(true);
  expect(fallback.length).toBe(64);

  expect(kitPurchaseStep("checkout", "bump-replay")).toBe("checkout");
  expect(kitPurchaseStep("upsell", "launch")).toBe("launch");
  expect(kitPurchaseStep("upsell", "webinar-system")).toBe("webinar");
  expect(kitPurchaseStep("upsell", "bump-install")).toBe("thanks");

  const rows = kitPurchaseEventRows({
    lines: [
      { line_id: "kit", amount_cents: 2700 },
      { line_id: "bump-replay", amount_cents: 1700 },
      { line_id: "nope", amount_cents: 100 },
    ],
    checkoutSessionId: "cs_live_order1",
    ofkSessionId: "browser-session-1",
    source: "checkout",
    metadata: { utm_source: "facebook", utm_campaign: "kit", fbclid: "ad" },
  });
  expect(rows.map((row) => row.line_id)).toEqual(["kit", "bump-replay"]);
  expect(rows[0]).toMatchObject({
    event: "purchase",
    session_id: "browser-session-1",
    step: "checkout",
    checkout_session_id: "cs_live_order1",
    utm_source: "facebook",
    utm_campaign: "kit",
    fbclid: "ad",
  });
  expect(kitPurchaseEventRows({
    lines: [{ line_id: "kit", amount_cents: 2700 }],
    checkoutSessionId: "not-a-session",
    source: "checkout",
  })).toEqual([]);

  const inserted: unknown[] = [];
  await insertKitPurchaseEvents({
    from(table: string) {
      expect(table).toBe("kit_events");
      return {
        select() {
          return {
            eq() {
              return {
                eq: async () => ({ data: [{ line_id: "kit" }], error: null }),
              };
            },
          };
        },
        insert: async (batch: unknown[]) => {
          inserted.push(...batch);
          return { error: null };
        },
      };
    },
  }, {
    lines: [
      { line_id: "kit", amount_cents: 2700 },
      { line_id: "launch", amount_cents: 14700 },
    ],
    checkoutSessionId: "cs_live_order1",
    ofkSessionId: null,
    source: "upsell",
  });
  expect(inserted).toHaveLength(1);
  expect(inserted[0]).toMatchObject({ line_id: "launch", step: "launch", event: "purchase" });

  await expect(insertKitPurchaseEvents({
    from() {
      throw new Error("database down");
    },
  }, {
    lines: [{ line_id: "kit", amount_cents: 2700 }],
    checkoutSessionId: "cs_live_order2",
    source: "checkout",
  })).resolves.toBeUndefined();

  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  expect(payment).toContain("ofk_session_id");
  expect(payment).toContain("isKitOfkSessionId");
  expect(webhook).toContain("insertKitPurchaseEvents");
  expect(webhook.indexOf("insertKitPurchaseEvents")).toBeGreaterThan(webhook.indexOf("saveKitEntitlements"));
});

test("a browser without crypto.randomUUID still mints a funnel session and a view id", () => {
  const env = installBrowser({ hostname: "onefeaturekit.com" });
  const previous = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { getRandomValues: previous.getRandomValues.bind(previous) },
  });
  try {
    const session = touchKitSession(5_000);
    expect(isKitOfkSessionId(session?.id ?? "")).toBe(true);
    const view = claimKitPageView("launch", "/launch-pack", 5_000);
    expect(view.send).toBe(true);
    expect(isKitOfkSessionId(view.viewId)).toBe(true);
  } finally {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: previous });
    env.restore();
  }
});

test("the funnel session rolls for 30 minutes and ?ofk_test=1 stays sticky", () => {
  const env = installBrowser({ hostname: "onefeaturekit.com", search: "?ofk_test=1" });
  try {
    const first = touchKitSession(1_000);
    expect(first?.test).toBe(true);
    expect(kitSessionIsTest(2_000)).toBe(true);
    (globalThis.window as { location: { search: string } }).location.search = "";
    const kept = touchKitSession(3_000);
    expect(kept?.id).toBe(first?.id);
    expect(kept?.test).toBe(true);
    const expired = touchKitSession(3_000 + 30 * 60 * 1000 + 1);
    expect(expired?.id).not.toBe(first?.id);
    // ofk_test is an alias for the 24-hour ss_test flag, so a new session stays marked.
    expect(expired?.test).toBe(true);
    (globalThis.window as { location: { search: string } }).location.search = "?ss_test=0";
    const cleared = touchKitSession((expired?.touchedAt ?? 0) + 1);
    expect(cleared?.test).toBe(false);
    expect(kitFunnelSessionId(cleared?.touchedAt)).toBe(cleared?.id);
  } finally {
    env.restore();
  }
});

test("an early view and a recent checkout view are not inserted twice", () => {
  const env = installBrowser({ hostname: "saassuite.ai" });
  try {
    const session = touchKitSession(10_000);
    (globalThis.window as { __ofkEarlyView?: unknown }).__ofkEarlyView = {
      id: "view-early",
      path: "/one-feature-kit",
      step: "sales",
      sessionId: session?.id,
    };
    expect(claimKitPageView("sales", "/one-feature-kit", 10_000)).toEqual({ send: false, viewId: "view-early" });

    const first = claimKitPageView("checkout", "/one-feature-kit/checkout", 20_000);
    expect(first.send).toBe(true);
    expect(claimKitPageView("checkout", "/one-feature-kit/checkout", 25_000).send).toBe(false);
    expect(claimKitPageView("checkout", "/one-feature-kit/checkout", 20_000 + 30_000).send).toBe(true);

    expect(markKitCheckoutStart(40_000)).toBe(true);
    expect(markKitCheckoutStart(41_000)).toBe(false);
  } finally {
    env.restore();
  }
});

test("a missing is_test column is retried without the new fields", async () => {
  const env = installBrowser({ hostname: "onefeaturekit.com", search: "?ofk_test=1" });
  resetKitEventColumnProbe();
  const bodies: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    bodies.push(typeof init?.body === "string" ? init.body : "");
    if (calls === 1) {
      return new Response(JSON.stringify({
        code: "PGRST204",
        message: "Could not find the 'is_test' column of 'kit_events' in the schema cache",
      }), { status: 400, headers: { "content-type": "application/json" } });
    }
    return new Response("", { status: 201 });
  };
  try {
    await trackKitEvent("view", { step: "sales", properties: { view_id: "abc" } });
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(bodies[0]).is_test).toBe(true);
    expect(JSON.parse(bodies[1]).is_test).toBeUndefined();
    expect(JSON.parse(bodies[1]).properties).toBeUndefined();
    expect(JSON.parse(bodies[1]).event).toBe("view");
  } finally {
    resetKitEventColumnProbe();
    env.restore();
  }
});

test("a sales view still hashes the user agent when Web Crypto is missing", async () => {
  const env = installBrowser({ userAgent: "KitTest/1.0" });
  const subtle = crypto.subtle;
  Object.defineProperty(crypto, "subtle", { configurable: true, value: undefined });
  try {
    const row = await buildKitEventRow("view", { step: "sales" });
    expect(row?.ua_hash).toBe(sha256Hex("KitTest/1.0"));
    expect(row?.ua_hash).toMatch(/^[0-9a-f]{64}$/);
  } finally {
    Object.defineProperty(crypto, "subtle", { configurable: true, value: subtle });
    env.restore();
  }
});

test("the early kit view hashes the user agent before the insert", async () => {
  const html = readFileSync("index.html", "utf8");
  const early = html.slice(html.indexOf("Kit view before React"), html.indexOf('src="/src/main.tsx"'));
  const start = early.indexOf("function sha256Hex(text)");
  const end = early.indexOf("\n        try {", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const inline = new Function(`${early.slice(start, end)}; return sha256Hex;`)() as (value: string) => string;
  const samples = ["", "abc", "KitTest/1.0", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", "café 😀"];
  for (const sample of samples) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sample));
    const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(inline(sample)).toBe(expected);
    expect(sha256Hex(sample)).toBe(expected);
  }
  expect(early).toContain("row.ua_hash = uaHex");
  expect(early).not.toContain("crypto.subtle.digest");
  expect(early).not.toContain(".catch(function () { send(row); })");
  expect(early.indexOf("row.ua_hash = uaHex")).toBeLessThan(early.lastIndexOf("send(row)"));
});

test("index.html records the kit view before React and defers kit pixels", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain("ofk_session");
  expect(html).toContain("ofk_test");
  expect(html).toContain("__ofkEarlyView");
  expect(html).toContain("requestIdleCallback");
  expect(html).toContain("requestIdleCallback(function () { loadGtm(); releaseHost(); }, { timeout: 2000 })");
  expect(html).toContain("}, 10000);");
  expect(html).not.toContain("requestIdleCallback(loadGtm, { timeout: 1200 })");
  expect(html).not.toContain("setTimeout(loadGtm, 4000)");
  expect(html).not.toContain("setTimeout(loadGtm, 8000)");
  expect(html).toContain("fbq('track', 'PageView', {}, {eventID: window.__ofkMetaIds.pageViewId})");
  expect(html).toContain("GTM-M7B83SRK");
  expect(html.indexOf("__ofkEarlyView")).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
  const checkout = readFileSync("src/funnel/one-feature-kit/embeddedCheckout.ts", "utf8");
  expect(checkout).toContain('import("@stripe/stripe-js")');
  expect(checkout).not.toMatch(/^import\s+\{[^}]*\bloadStripe\b/m);
  expect(readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8")).toContain("preloadKitStripe()");
  const page = readFileSync("src/pages/OneFeatureKit.tsx", "utf8");
  expect(page).toContain("const path = canonical ?? pathname");
  expect(page).toContain("mod.trackFunnelPageview(path, confirmedBuyerEmail)");
  const query = readFileSync("docs/kit-funnel-query.sql", "utf8");
  expect(query).toContain("e.is_test is not true");
});

test("a kit step writes one site_analytics pageview and other funnel events stay out", async () => {
  const env = installBrowser({
    hostname: "onefeaturekit.com",
    search: "?utm_source=facebook&fbclid=test",
    referrer: "https://facebook.com/",
  });
  const sent: Blob[] = [];
  (globalThis.navigator as Navigator & { sendBeacon: (url: string, data?: BodyInit) => boolean }).sendBeacon = (_url, data) => {
    if (data instanceof Blob) sent.push(data);
    return true;
  };
  try {
    trackSiteEvent("click", "play");
    expect(sent).toHaveLength(0);
    trackFunnelPageview("/one-feature-kit");
    expect(sent).toHaveLength(1);
    const row = JSON.parse(await sent[0].text()) as Record<string, unknown>;
    expect(row.event_type).toBe("pageview");
    expect(row.path).toBe("/one-feature-kit");
    expect(row.utm_source).toBe("facebook");
    expect(row.fbclid).toBe("test");
    expect(row.referrer).toBe("https://facebook.com/");
    expect(row.is_app_page).toBe(false);
    expect(typeof row.session_id).toBe("string");
    expect(row.user_email).toBeUndefined();
    trackFunnelPageview("/one-feature-kit/ghl-signup-and-upgrade", "Buyer@Example.com");
    expect(sent).toHaveLength(2);
    const thanks = JSON.parse(await sent[1].text()) as Record<string, unknown>;
    expect(thanks.user_email).toBe("buyer@example.com");
    expect(thanks.path).toBe("/one-feature-kit/ghl-signup-and-upgrade");
    expect(thanks.event_type).toBe("pageview");
  } finally {
    env.restore();
  }

  const optedOut = installBrowser({ hostname: "saassuite.ai", search: "?utm_source=facebook", optedOut: true });
  const blocked: Blob[] = [];
  (globalThis.navigator as Navigator & { sendBeacon: (url: string, data?: BodyInit) => boolean }).sendBeacon = (_url, data) => {
    if (data instanceof Blob) blocked.push(data);
    return true;
  };
  try {
    trackFunnelPageview("/one-feature-kit");
    expect(blocked).toHaveLength(0);
  } finally {
    optedOut.restore();
  }
});
