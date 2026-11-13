import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { installFetchGuard } from "./fetchGuard";
import { sha256Hex } from "../supabase/functions/_shared/kit-stape";
import {
  kitCheckoutMetaPurchase,
  kitPurchaseEventId,
  kitUpsellMetaPurchase,
} from "../supabase/functions/_shared/kit-meta";
import {
  STAPE_PIXEL_IDS,
  appPurchaseClaimKey,
  buildStapeDataPurchase,
  claimPurchaseAction,
  deliverClaimedStapePurchase,
  purchaseEventId,
  purchaseRoutePlan,
  routeServerPurchase,
  stapeDataEndpoint,
  stapeEventName,
  type PurchaseActionDb,
  type PurchaseRoute,
  type StapeDataPurchaseInput,
} from "../supabase/functions/_shared/stape-purchase";

installFetchGuard();

const SESSION = "cs_live_abc123";
const EVENT_TIME = 1_700_000_000;

function livePurchase(overrides: Partial<StapeDataPurchaseInput> = {}): StapeDataPurchaseInput {
  return {
    eventId: purchaseEventId(SESSION),
    eventTimeSec: EVENT_TIME,
    value: 370,
    currency: "usd",
    orderId: SESSION,
    email: "Buyer@Example.com",
    phone: "(555) 123-4567",
    firstName: "Ada Lovelace",
    fbp: "fb.1.1700000000000.111",
    fbc: "fb.1.1700000000000.click",
    eventSourceUrl: "https://saassuite.ai/one-feature-kit/checkout",
    clientIp: "203.0.113.10",
    clientUserAgent: "Mozilla/5.0 Test",
    externalId: "cus_123",
    contentIds: ["kit"],
    contentName: "The GoHighLevel One Feature Kit",
    numItems: 1,
    ...overrides,
  };
}

function stapePlan(overrides: Parameters<typeof purchaseRoutePlan>[0] = {}): PurchaseRoute {
  const plan = purchaseRoutePlan({
    serverUrl: "https://xyaheorc.usw.stape.io",
    isTest: false,
    ...overrides,
  });
  return plan;
}

type Row = { completed: boolean; leaseUntil: number };

function memoryDb(seed: Record<string, Row> = {}) {
  const rows = new Map<string, Row>(Object.entries(seed));
  const db: PurchaseActionDb = {
    rpc: async (_fn, args) => {
      const now = Date.now();
      const row = rows.get(args.p_key);
      if (!row) {
        rows.set(args.p_key, { completed: false, leaseUntil: now + 300_000 });
        return { data: true, error: null };
      }
      if (!row.completed && row.leaseUntil <= now) {
        row.leaseUntil = now + 300_000;
        return { data: true, error: null };
      }
      return { data: false, error: null };
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, key: string) => ({
          maybeSingle: async () => {
            const row = rows.get(key);
            return { data: row ? { completed: row.completed } : null, error: null };
          },
        }),
      }),
      update: (patch: { completed?: boolean; lease_until?: string }) => ({
        eq: async (_column: string, key: string) => {
          const row = rows.get(key);
          if (!row) return { error: { message: "missing" } };
          if (patch.completed === true) row.completed = true;
          if (patch.lease_until) row.leaseUntil = Date.parse(patch.lease_until);
          return { error: null };
        },
      }),
    }),
  };
  return { db, rows };
}

test("the fetch guard throws before any live host is contacted", async () => {
  const hosts = [
    "https://xyaheorc.usw.stape.io/data",
    "https://graph.facebook.com/v21.0/745177780828109/events",
    "https://api.stripe.com/v1/checkout/sessions",
    "https://example.supabase.co/rest/v1/saas_suite_users",
    "https://services.leadconnectorhq.com/hooks/example",
    "https://slack.com/api/chat.postMessage",
  ];
  for (const url of hosts) {
    await expect(fetch(url)).rejects.toThrow(/blocked live fetch/);
  }
});

test("kit and app Purchase event ids match the browser pixel", async () => {
  const kit = kitCheckoutMetaPurchase({
    sessionId: SESSION,
    amountTotalCents: 37000,
    comped: false,
    trackingOptout: false,
    lines: [{ id: "kit", amountCents: 37000, name: "The GoHighLevel One Feature Kit" }],
  });
  expect(kit?.eventId).toBe(kitPurchaseEventId(SESSION));
  expect(kit?.eventId).toBe(purchaseEventId(SESSION));
  expect(kit?.eventId).toBe(`order_${SESSION}`);

  const body = await buildStapeDataPurchase(livePurchase({ eventId: kit!.eventId, orderId: SESSION }));
  expect(body.event_id).toBe(`order_${SESSION}`);
  expect(body.event_name).toBe("Purchase");
  expect(body.event_time).toBe(EVENT_TIME);

  const browser = readFileSync("src/funnel/one-feature-kit/tracking.ts", "utf8");
  expect(browser).toContain("kitPurchaseEventId(input.sessionId)");
  expect(browser).toContain("const eventId = kitPurchaseEventId(input.paymentIntentId)");
  expect(browser).toContain('fn("track", eventName, data, { eventID: eventId })');
  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  expect(wire).toContain("paymentIntentId: charge.paymentIntentId");
  const appCheckout = readFileSync("src/components/StripeEmbeddedCheckout.tsx", "utf8");
  expect(appCheckout).toContain("const purchaseEventId = `order_${");
  const course = readFileSync("src/components/course/CourseCheckout.tsx", "utf8");
  expect(course).toContain("const purchaseEventId = `order_${");
  const confirmed = readFileSync("src/pages/App.tsx", "utf8");
  expect(confirmed).toContain("eventId: `order_${");

  const upsell = kitUpsellMetaPurchase({
    paymentIntentId: "pi_upsell123",
    amountReceivedCents: 9700,
    offerId: "launch",
    trackingOptout: false,
  });
  expect(upsell?.eventId).toBe("order_pi_upsell123");
  expect(upsell?.eventId).not.toBe(purchaseEventId(SESSION));
});

test("one JSON Purchase lists both pixels and hashes match data", async () => {
  const posts: { url: string; body: string; headers: Record<string, string> }[] = [];
  let direct = 0;
  const plan = stapePlan();
  expect(plan.route).toBe("stape");
  if (plan.route !== "stape") return;
  expect(plan.endpoint).toBe("https://xyaheorc.usw.stape.io/data");
  expect(plan.eventName).toBe("Purchase");

  const result = await routeServerPurchase({
    plan,
    orderId: SESSION,
    purchase: livePurchase(),
    post: async (url, body, headers) => {
      posts.push({ url, body, headers });
      return { ok: true };
    },
    sendDirect: async () => {
      direct += 1;
      return true;
    },
  });
  expect(result).toEqual({ via: "stape", ok: true });
  expect(direct).toBe(0);
  expect(posts).toHaveLength(1);
  expect(posts[0].url).toBe("https://xyaheorc.usw.stape.io/data");
  expect(posts[0].headers["Content-Type"]).toBe("application/json");

  const payload = JSON.parse(posts[0].body) as {
    event_name: string;
    event_id: string;
    event_time: number;
    action_source: string;
    event_source_url: string;
    pixel_ids: string[];
    test_event_code?: string;
    user_data: Record<string, unknown>;
    custom_data: { value: number; currency: string; content_ids: string[]; order_id: string };
    "x-fb-ud-em": string;
    "x-fb-ud-ph": string;
    "x-fb-ud-fn": string;
    "x-fb-ud-ln": string;
    "x-fb-ud-external_id": string;
    "x-fb-ck-fbp": string;
    "x-fb-ck-fbc": string;
    ip_override: string;
    user_agent: string;
    page_location: string;
    value: number;
    currency: string;
    transaction_id: string;
  };
  expect(payload.event_id).toBe(`order_${SESSION}`);
  expect(payload.event_time).toBe(EVENT_TIME);
  expect(payload.action_source).toBe("website");
  expect(payload.event_source_url).toBe("https://saassuite.ai/one-feature-kit/checkout");
  expect(payload.pixel_ids).toEqual([...STAPE_PIXEL_IDS]);
  expect(payload.pixel_ids).toEqual(["745177780828109", "1601372838188959"]);
  expect(payload.test_event_code).toBeUndefined();
  expect(payload.custom_data).toMatchObject({
    value: 370,
    currency: "USD",
    content_ids: ["kit"],
    order_id: SESSION,
  });
  const user = payload.user_data;
  expect(user.em).toEqual([await sha256Hex("buyer@example.com")]);
  expect(user.ph).toEqual([await sha256Hex("15551234567")]);
  expect(user.fn).toEqual([await sha256Hex("ada")]);
  expect(user.ln).toEqual([await sha256Hex("lovelace")]);
  expect(user.external_id).toEqual([await sha256Hex("cus_123")]);
  expect(user.fbp).toBe("fb.1.1700000000000.111");
  expect(user.fbc).toBe("fb.1.1700000000000.click");
  expect(user.client_ip_address).toBe("203.0.113.10");
  expect(user.client_user_agent).toBe("Mozilla/5.0 Test");
  expect(JSON.stringify(user)).not.toContain("Buyer@Example.com");
  expect(JSON.stringify(user)).not.toContain("555");
  expect(payload["x-fb-ud-em"]).toBe((user.em as string[])[0]);
  expect(payload["x-fb-ud-ph"]).toBe((user.ph as string[])[0]);
  expect(payload["x-fb-ud-fn"]).toBe((user.fn as string[])[0]);
  expect(payload["x-fb-ud-ln"]).toBe((user.ln as string[])[0]);
  expect(payload["x-fb-ud-external_id"]).toBe((user.external_id as string[])[0]);
  expect(typeof payload["x-fb-ud-em"]).toBe("string");
  expect(Array.isArray(payload["x-fb-ud-em"])).toBe(false);
  expect(payload["x-fb-ck-fbp"]).toBe(user.fbp);
  expect(payload["x-fb-ck-fbc"]).toBe(user.fbc);
  expect(payload.ip_override).toBe(user.client_ip_address);
  expect(payload.user_agent).toBe(user.client_user_agent);
  expect(payload.page_location).toBe(payload.event_source_url);
  expect(payload.value).toBe(payload.custom_data.value);
  expect(payload.currency).toBe(payload.custom_data.currency);
  expect(payload.transaction_id).toBe(payload.custom_data.order_id);
  expect(payload.event_id).toBe(`order_${SESSION}`);
});

test("empty inherit-from-client keys are omitted instead of sent blank", async () => {
  const body = await buildStapeDataPurchase(livePurchase({
    email: "   ",
    phone: "",
    firstName: null,
    lastName: " ",
    fbp: "",
    fbc: null,
    fbclid: "  ",
    clientIp: "   ",
    clientUserAgent: null,
    externalId: "",
    testEventCode: "   ",
  }));
  const omitted = [
    "x-fb-ud-em",
    "x-fb-ud-ph",
    "x-fb-ud-fn",
    "x-fb-ud-ln",
    "x-fb-ud-external_id",
    "x-fb-ck-fbp",
    "x-fb-ck-fbc",
    "ip_override",
    "user_agent",
    "test_event_code",
  ];
  for (const key of omitted) expect(body[key]).toBeUndefined();
  const serialized = JSON.stringify(body);
  for (const key of omitted) expect(serialized).not.toContain(`"${key}":""`);
  expect(body.page_location).toBe(body.event_source_url);
  expect(body.value).toBe(370);
  expect(body.currency).toBe("USD");
  expect(body.transaction_id).toBe(SESSION);
  const user = body.user_data as Record<string, unknown>;
  expect(user.em).toBeUndefined();
  expect(user.client_ip_address).toBeUndefined();
  expect(user.client_user_agent).toBeUndefined();
  expect(Array.isArray(body.user_data)).toBe(false);
});

test("milliseconds become unix seconds and a full name is split", async () => {
  const body = await buildStapeDataPurchase(livePurchase({
    eventTimeSec: 1_700_000_000_000,
    firstName: "Ada",
    lastName: "Lovelace",
    fbc: null,
    fbclid: "IwAR2click",
  }));
  expect(body.event_time).toBe(1_700_000_000);
  const user = body.user_data as { fn: string[]; ln: string[]; fbc: string };
  expect(user.fn).toEqual([await sha256Hex("ada")]);
  expect(user.ln).toEqual([await sha256Hex("lovelace")]);
  expect(user.fbc).toBe(`fb.1.${1_700_000_000 * 1000}.IwAR2click`);
});

test("path and event name stay configurable and default to /data and Purchase", () => {
  expect(stapeDataEndpoint("https://xyaheorc.usw.stape.io", null)).toBe("https://xyaheorc.usw.stape.io/data");
  expect(stapeDataEndpoint("https://xyaheorc.usw.stape.io/", "/events")).toBe("https://xyaheorc.usw.stape.io/events");
  expect(stapeDataEndpoint("https://xyaheorc.usw.stape.io/g/collect", "not-a-path")).toBe("https://xyaheorc.usw.stape.io/data");
  expect(stapeDataEndpoint("http://xyaheorc.usw.stape.io", "/data")).toBeNull();
  expect(stapeDataEndpoint("", "/data")).toBeNull();
  expect(stapeEventName("")).toBe("Purchase");
  expect(stapeEventName("AddToCart")).toBe("AddToCart");
  expect(stapeEventName("Purchase alert")).toBe("Purchase");
  const named = stapePlan({ purchasePath: "/events", eventName: "AddToCart" });
  expect(named).toMatchObject({ route: "stape", endpoint: "https://xyaheorc.usw.stape.io/events", eventName: "AddToCart" });
});

test("a test order carries test_event_code and a live order does not", () => {
  const live = stapePlan({ stapeTestEventCode: "ENVCODE", explicitTestEventCode: "ORDERCODE" });
  expect(live.route).toBe("stape");
  if (live.route === "stape") expect(live.testEventCode).toBeUndefined();

  const fromOrder = stapePlan({ isTest: true, stapeTestEventCode: "ENVCODE", explicitTestEventCode: "ORDERCODE" });
  expect(fromOrder).toMatchObject({ route: "stape", testEventCode: "ORDERCODE" });

  const fromEnv = stapePlan({ isTest: true, stapeTestEventCode: "ENVCODE" });
  expect(fromEnv).toMatchObject({ route: "stape", testEventCode: "ENVCODE" });

  const qa = stapePlan({ utmSource: "qa_test", stapeTestEventCode: "ENVCODE" });
  expect(qa).toMatchObject({ route: "stape", testEventCode: "ENVCODE" });

  expect(stapePlan({ isTest: true })).toEqual({ route: "skip", reason: "test_traffic" });
  expect(stapePlan({ utmSource: "qa_test" })).toEqual({ route: "skip", reason: "test_traffic" });
  expect(stapePlan({ serverUrl: null, isTest: false, utmSource: "qa_test" })).toEqual({ route: "direct" });
  expect(stapePlan({ serverUrl: "", isTest: true, metaTestEventCode: "METACODE" })).toEqual({ route: "direct" });
  expect(stapePlan({ serverUrl: null, isTest: true })).toEqual({ route: "skip", reason: "test_traffic" });
});

test("an unset Stape URL calls the direct Purchase and does not post", async () => {
  let direct = 0;
  const posted: string[] = [];
  const result = await routeServerPurchase({
    plan: purchaseRoutePlan({ serverUrl: undefined, isTest: false }),
    orderId: SESSION,
    purchase: livePurchase(),
    post: async (_url, body) => {
      posted.push(body);
      return { ok: true };
    },
    sendDirect: async () => {
      direct += 1;
      return true;
    },
  });
  expect(result).toEqual({ via: "direct", ok: true });
  expect(direct).toBe(1);
  expect(posted).toHaveLength(0);
});

test("Stape and direct Meta are not both sent", async () => {
  const plan = stapePlan({ isTest: true, explicitTestEventCode: "TEST999" });
  expect(plan.route).toBe("stape");
  let direct = 0;
  const result = await routeServerPurchase({
    plan,
    orderId: SESSION,
    purchase: livePurchase(),
    post: async () => ({ ok: true }),
    sendDirect: async () => {
      direct += 1;
      return true;
    },
  });
  expect(result.via).toBe("stape");
  expect(direct).toBe(0);
  const body = await buildStapeDataPurchase({ ...livePurchase(), testEventCode: "TEST999" });
  expect(body.test_event_code).toBe("TEST999");
  const liveBody = await buildStapeDataPurchase(livePurchase());
  expect(liveBody.test_event_code).toBeUndefined();
});

test("a completed claim does not post the Purchase again", async () => {
  const { db } = memoryDb();
  const posts: string[] = [];
  const plan = stapePlan();
  if (plan.route !== "stape") throw new Error("expected stape");
  const send = () => deliverClaimedStapePurchase({
    plan,
    orderId: SESSION,
    purchase: livePurchase(),
    db,
    claimKey: appPurchaseClaimKey(SESSION),
    post: async (_url, body) => {
      posts.push(body);
      return { ok: true };
    },
  });
  expect(await send()).toEqual({ ok: true });
  expect(await send()).toEqual({ ok: true, skipped: "duplicate" });
  expect(posts).toHaveLength(1);
  const payload = JSON.parse(posts[0]) as { event_id: string; pixel_ids: string[] };
  expect(payload.event_id).toBe(`order_${SESSION}`);
  expect(payload.pixel_ids).toHaveLength(2);
});

test("a failed Stape post releases the claim so a retry can send once", async () => {
  const { db } = memoryDb();
  const posts: boolean[] = [];
  const plan = stapePlan();
  if (plan.route !== "stape") throw new Error("expected stape");
  let attempt = 0;
  const send = () => deliverClaimedStapePurchase({
    plan,
    orderId: SESSION,
    purchase: livePurchase(),
    db,
    claimKey: appPurchaseClaimKey(SESSION),
    post: async () => {
      attempt += 1;
      const ok = attempt > 1;
      posts.push(ok);
      return { ok };
    },
  });
  expect((await send()).ok).toBe(false);
  expect((await send()).ok).toBe(true);
  expect((await send()).skipped).toBe("duplicate");
  expect(posts).toEqual([false, true]);
});

test("an in-flight claim does not send a second Purchase", async () => {
  const key = appPurchaseClaimKey(SESSION);
  const { db } = memoryDb({ [key]: { completed: false, leaseUntil: Date.now() + 60_000 } });
  const posts: string[] = [];
  const plan = stapePlan();
  if (plan.route !== "stape") throw new Error("expected stape");
  const result = await deliverClaimedStapePurchase({
    plan,
    orderId: SESSION,
    purchase: livePurchase(),
    db,
    claimKey: key,
    post: async () => {
      posts.push("sent");
      return { ok: true };
    },
  });
  expect(result).toEqual({ ok: false, skipped: "busy" });
  expect(posts).toHaveLength(0);
  expect(await claimPurchaseAction(db, key)).toBe("busy");
});

test("Purchase call sites keep a direct Meta path and a single Stape path", () => {
  const capi = readFileSync("supabase/functions/meta-capi/index.ts", "utf8");
  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const stripe = readFileSync("supabase/functions/stripe-subscription-webhook/index.ts", "utf8");
  const notify = readFileSync("supabase/functions/notify-stripe-purchase/index.ts", "utf8");
  expect(capi).toContain('console.log("meta-capi skipped Purchase stape"');
  expect(webhook).toContain("sendKitRoutedPurchase");
  expect(stripe).toContain("sendClaimedSubscriptionPurchase");
  expect(stripe).toContain("sendMetaPurchase");
  expect(notify).toContain("sendClaimedSubscriptionPurchase");
  expect(notify).toContain("sendMetaPurchase");
  expect(appPurchaseClaimKey(SESSION).startsWith("meta:")).toBe(false);

  const notifyStape = notify.slice(
    notify.indexOf('purchaseRoute.route === "stape"'),
    notify.indexOf('console.log("purchase route direct"'),
  );
  expect(notifyStape).toContain("sessionMeta.client_ip");
  expect(notifyStape).toContain("sessionMeta.client_ua");
  expect(notifyStape).not.toContain("x-forwarded-for");
  expect(notifyStape).not.toContain("user-agent");
  expect(notifyStape).not.toContain("clientIpFromForwarded");

  const stripeStape = stripe.slice(
    stripe.indexOf('purchaseRoute.route === "stape"'),
    stripe.indexOf('console.log("purchase route direct"'),
  );
  expect(stripeStape).toContain("md.client_ip");
  expect(stripeStape).toContain("md.client_ua");
  expect(stripeStape).not.toContain("x-forwarded-for");
  expect(stripeStape).not.toContain("user-agent");
  expect(stripeStape).not.toContain("req.headers");
});
