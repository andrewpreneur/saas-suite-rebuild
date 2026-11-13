import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { KIT_CATALOG, KIT_CUSTOMER_COPY, kitCheckoutIds, kitTotal } from "../supabase/functions/_shared/kit-catalog";
import {
  chargedUsd,
  kitCheckoutMetaPurchase,
  kitInitiateCheckoutEventId,
  kitLeadEventId,
  kitMetaActionKey,
  kitMetaClaimDecision,
  kitPageViewEventId,
  kitPaymentIntentKind,
  kitPurchaseEventId,
  kitStripeTrackingMetadata,
  kitUpsellEventSource,
  kitUpsellMetaPurchase,
  kitViewContentEventId,
  META_LEAD_PIXEL_ID,
  runMetaPurchaseDelivery,
} from "../supabase/functions/_shared/kit-meta";
import { kitLynkificActionKey, kitPurchasedPayload, runLynkificDelivery } from "../supabase/functions/_shared/kit-lynkific";
import {
  authorizePurchase,
  browserOriginAllowed,
  checkoutPaymentCollected,
  defaultPixelIds,
  isCheckoutTrial,
  isServiceRoleRequest,
  metaCustomData,
  metaEventAllowed,
  metaPhoneDigits,
  resolvedClientNetwork,
  secretEquals,
  trialPlanPriceCents,
} from "../supabase/functions/_shared/meta-capi-policy";
import { KIT_META_RETRY_MAX_ATTEMPTS, kitMetaRetryDue, kitMetaRetryOrderId, kitMetaRetryPlan } from "../supabase/functions/_shared/kit-meta-retry";

const ALL_BUMPS = { replay: true, video: true, install: true };
const bumpLines = () => kitCheckoutIds(ALL_BUMPS).map(id => ({
  id,
  amountCents: KIT_CATALOG[id].amount,
  name: KIT_CUSTOMER_COPY[id].name,
}));

test("kit event ids match the funnel scheme", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  expect(kitPageViewEventId(uuid)).toBe(`pv_${uuid}`);
  expect(kitViewContentEventId(uuid)).toBe(`vc_${uuid}`);
  expect(kitPageViewEventId(uuid).slice(3)).toBe(kitViewContentEventId(uuid).slice(3));
  expect(kitLeadEventId("abcdef0123456789ffff")).toBe("lead_ofk_abcdef0123456789");
  expect(kitLeadEventId("abcdef0123456789ffff")).toMatch(/^lead_ofk_[0-9a-f]{16}$/);
  expect(kitInitiateCheckoutEventId("cs_live_qa")).toBe("ic_cs_live_qa");
  expect(kitPurchaseEventId("cs_live_qa")).toBe("order_cs_live_qa");
  expect(kitPurchaseEventId("pi_3QaUpsell")).toBe("order_pi_3QaUpsell");
  expect(kitMetaActionKey("cs_live_qa")).toBe("meta:cs_live_qa");
  expect(kitMetaActionKey("pi_3QaUpsell")).toBe("meta:pi_3QaUpsell");
});

test("an all-bumps checkout Purchase is $370 on order_<session>", () => {
  const ids = kitCheckoutIds(ALL_BUMPS);
  expect(kitTotal(ids)).toBe(37000);
  expect(chargedUsd(37000)).toBe(370);
  const purchase = kitCheckoutMetaPurchase({
    sessionId: "cs_live_qa370",
    amountTotalCents: kitTotal(ids),
    comped: false,
    trackingOptout: false,
    lines: bumpLines(),
  });
  expect(purchase).toMatchObject({
    eventId: "order_cs_live_qa370",
    orderId: "cs_live_qa370",
    value: 370,
    currency: "USD",
    contentIds: ["kit", "bump-replay", "bump-video", "bump-install"],
    numItems: 4,
    contentType: "product",
  });
  expect(purchase?.contents.map(item => item.item_price)).toEqual([27, 17, 27, 299]);
});

test("upsell Purchases are $147 and $97 on order_<payment intent>", () => {
  expect(KIT_CATALOG.launch.amount).toBe(14700);
  expect(KIT_CATALOG["webinar-system"].amount).toBe(9700);
  const launch = kitUpsellMetaPurchase({
    paymentIntentId: "pi_launchqa",
    amountReceivedCents: KIT_CATALOG.launch.amount,
    offerId: "launch",
    contentName: KIT_CUSTOMER_COPY.launch.name,
    itemAmountCents: KIT_CATALOG.launch.amount,
    trackingOptout: false,
  });
  const webinar = kitUpsellMetaPurchase({
    paymentIntentId: "pi_webinarqa",
    amountReceivedCents: KIT_CATALOG["webinar-system"].amount,
    offerId: "webinar-system",
    contentName: KIT_CUSTOMER_COPY["webinar-system"].name,
    itemAmountCents: KIT_CATALOG["webinar-system"].amount,
    trackingOptout: false,
  });
  expect(launch).toMatchObject({ eventId: "order_pi_launchqa", value: 147, contentIds: ["launch"], numItems: 1 });
  expect(webinar).toMatchObject({ eventId: "order_pi_webinarqa", value: 97, contentIds: ["webinar-system"] });
  expect(launch?.contents[0].item_price).toBe(147);
  expect(webinar?.contents[0].item_price).toBe(97);
});

test("a future downsell uses order_<payment intent> and the charged amount", () => {
  const downsell = kitUpsellMetaPurchase({
    paymentIntentId: "pi_downsellqa",
    amountReceivedCents: 4700,
    offerId: "downsell-replay",
    contentName: "Replay downsell",
    trackingOptout: false,
  });
  expect(downsell).toMatchObject({ eventId: "order_pi_downsellqa", value: 47, contentIds: ["downsell-replay"] });
  expect(kitPaymentIntentKind({ funnel: "one-feature-kit", offer_id: "downsell-replay" })).toBe("upsell");
  expect(kitPaymentIntentKind({ funnel: "one-feature-kit" })).toBe("checkout");
  expect(kitPaymentIntentKind({ funnel: "subscription", offer_id: "launch" })).toBe("ignore");
});

test("comped and $0 orders do not send a Purchase", () => {
  const lines = bumpLines();
  expect(kitCheckoutMetaPurchase({
    sessionId: "cs_live_comped",
    amountTotalCents: 0,
    comped: true,
    trackingOptout: false,
    lines,
  })).toBeNull();
  expect(kitCheckoutMetaPurchase({
    sessionId: "cs_live_zero",
    amountTotalCents: 0,
    comped: false,
    trackingOptout: false,
    lines,
  })).toBeNull();
  expect(kitCheckoutMetaPurchase({
    sessionId: "cs_live_optout",
    amountTotalCents: 37000,
    comped: false,
    trackingOptout: true,
    lines,
  })).toBeNull();
  expect(kitUpsellMetaPurchase({
    paymentIntentId: "pi_comped",
    amountReceivedCents: 0,
    offerId: "launch",
    trackingOptout: false,
  })).toBeNull();
  expect(kitUpsellMetaPurchase({
    paymentIntentId: "pi_optout",
    amountReceivedCents: 14700,
    offerId: "launch",
    trackingOptout: true,
  })).toBeNull();
});

test("a duplicate webhook delivery sends one Purchase", async () => {
  const purchase = kitCheckoutMetaPurchase({
    sessionId: "cs_live_once",
    amountTotalCents: 37000,
    comped: false,
    trackingOptout: false,
    lines: bumpLines(),
  });
  let completed = false;
  let leased = false;
  let sends = 0;
  const claim = () => {
    if (leased || completed) return false;
    leased = true;
    return true;
  };
  const deliver = () => runMetaPurchaseDelivery({
    claimed: claim(),
    completed,
    purchase,
    send: async () => {
      sends += 1;
      return true;
    },
    release: async () => {
      leased = false;
    },
    complete: async () => {
      completed = true;
      leased = false;
    },
  });
  expect(await deliver()).toBe("sent");
  expect(await deliver()).toBe("duplicate");
  expect(sends).toBe(1);
  expect(kitMetaClaimDecision(true, false)).toBe("send");
  expect(kitMetaClaimDecision(false, true)).toBe("skip");
  expect(kitMetaClaimDecision(false, false)).toBe("retry");
});

test("a failed Meta send releases the claim and does not throw", async () => {
  let released = false;
  let completed = false;
  const result = await runMetaPurchaseDelivery({
    claimed: true,
    completed: false,
    purchase: kitUpsellMetaPurchase({
      paymentIntentId: "pi_retry",
      amountReceivedCents: 9700,
      offerId: "webinar-system",
      trackingOptout: false,
    }),
    send: async () => false,
    release: async () => {
      released = true;
    },
    complete: async () => {
      completed = true;
    },
  });
  expect(result).toBe("failed");
  expect(released).toBe(true);
  expect(completed).toBe(false);
  let sends = 0;
  const busy = await runMetaPurchaseDelivery({
    claimed: false,
    completed: false,
    purchase: kitUpsellMetaPurchase({
      paymentIntentId: "pi_busy",
      amountReceivedCents: 14700,
      offerId: "launch",
      trackingOptout: false,
    }),
    send: async () => {
      sends += 1;
      return true;
    },
    release: async () => {},
    complete: async () => {},
  });
  expect(busy).toBe("busy");
  expect(sends).toBe(0);
  const thrown = await runMetaPurchaseDelivery({
    claimed: true,
    completed: false,
    purchase: kitUpsellMetaPurchase({
      paymentIntentId: "pi_throw",
      amountReceivedCents: 9700,
      offerId: "webinar-system",
      trackingOptout: false,
    }),
    send: async () => {
      throw new Error("meta down");
    },
    release: async () => {
      released = true;
    },
    complete: async () => {
      completed = true;
    },
  });
  expect(thrown).toBe("failed");
  expect(completed).toBe(false);
});

test("a Lynkific retry or overlap posts once", async () => {
  const payload = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "(555) 123-4567",
    name: "Ada Buyer",
    lineIds: ["kit"],
    amountCentsTotal: 37000,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_once",
    loginUrl: "https://saassuite.ai/signup?email=buyer%40example.com",
    magicLink: "https://auth.example/verify?token=1",
    purchasedAt: "2026-10-20T00:00:00.000Z",
  });
  let posts = 0;
  let completed = false;
  let leased = false;
  const claim = () => {
    if (leased || completed) return false;
    leased = true;
    return true;
  };
  const deliver = () => runLynkificDelivery({
    claimed: claim(),
    completed,
    payload,
    url: "https://hooks.example/kit",
    post: async () => {
      posts += 1;
      return { ok: true };
    },
    release: async () => {
      leased = false;
    },
    complete: async () => {
      completed = true;
      leased = false;
    },
  });
  expect(kitLynkificActionKey("cs_live_once")).toBe("lynkific:cs_live_once");
  expect(await deliver()).toBe("sent");
  expect(await deliver()).toBe("duplicate");
  expect(await runLynkificDelivery({
    claimed: false,
    completed: false,
    payload,
    url: "https://hooks.example/kit",
    post: async () => {
      posts += 1;
      return { ok: true };
    },
    release: async () => {},
    complete: async () => {},
  })).toBe("overlap");
  expect(posts).toBe(1);
});

test("checkout metadata keeps click ids, UTMs, IP and user agent", () => {
  const ua = `Mozilla/${"x".repeat(600)}`;
  const meta = kitStripeTrackingMetadata({
    tracking: {
      fbp: "fb.1.1.1",
      fbc: "fb.1.2.abc",
      fbclid: "abc",
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "kit",
      utm_content: "video",
      utm_term: "ghl",
      landing_page: "https://saassuite.ai/one-feature-kit",
      page_url: "https://saassuite.ai/one-feature-kit/checkout",
    },
    clientIp: "203.0.113.8, 10.0.0.1",
    clientUa: ua,
  });
  expect(meta.fbp).toBe("fb.1.1.1");
  expect(meta.fbc).toBe("fb.1.2.abc");
  expect(meta.fbclid).toBe("abc");
  expect(meta.utm_source).toBe("facebook");
  expect(meta.utm_campaign).toBe("kit");
  expect(meta.page_url).toBe("https://saassuite.ai/one-feature-kit/checkout");
  expect(meta.client_ip).toBe("203.0.113.8, 10.0.0.1");
  expect(meta.client_ua?.length).toBe(500);
  expect(meta.tracking_optout).toBe("false");
  const optedOut = kitStripeTrackingMetadata({
    tracking: { tracking_optout: true, fbp: "fb.1.1.1", fbclid: "abc" },
    clientIp: "203.0.113.8",
    clientUa: "Mozilla",
  });
  expect(optedOut).toEqual({ tracking_optout: "true" });
});

test("kit Lead names pixel 745 and other Leads still fan out", () => {
  expect(META_LEAD_PIXEL_ID).toBe("745177780828109");
  expect(defaultPixelIds("Lead", undefined, META_LEAD_PIXEL_ID)).toBeUndefined();
  expect(defaultPixelIds("CompleteRegistration", undefined, META_LEAD_PIXEL_ID)).toBeUndefined();
  expect(defaultPixelIds("Purchase", undefined, META_LEAD_PIXEL_ID)).toBeUndefined();
  expect(defaultPixelIds("InitiateCheckout", undefined, META_LEAD_PIXEL_ID)).toBeUndefined();
  expect(defaultPixelIds("Lead", [META_LEAD_PIXEL_ID], META_LEAD_PIXEL_ID)).toEqual(["745177780828109"]);
  expect(defaultPixelIds("Lead", ["1601372838188959"], META_LEAD_PIXEL_ID)).toEqual(["1601372838188959"]);
});

test("meta-capi accepts funnel events and keeps product fields", () => {
  for (const name of ["InitiateCheckout", "ViewContent", "AddPaymentInfo", "PageView", "Purchase", "Lead"]) {
    expect(metaEventAllowed(name)).toBe(true);
  }
  expect(metaEventAllowed("FakePurchase")).toBe(false);
  expect(metaCustomData({
    content_ids: ["kit", "bump-replay"],
    contents: [{ id: "kit", quantity: 1, item_price: 27 }],
    content_type: "product",
    content_name: "The GoHighLevel One Feature Kit",
    num_items: 4,
    order_id: "cs_live_qa370",
  }, 370, "USD")).toEqual({
    value: 370,
    currency: "USD",
    content_ids: ["kit", "bump-replay"],
    contents: [{ id: "kit", quantity: 1, item_price: 27 }],
    content_type: "product",
    content_name: "The GoHighLevel One Feature Kit",
    num_items: 4,
    order_id: "cs_live_qa370",
  });
});

test("browser calls fill a missing IP and a browser Purchase must match Stripe", () => {
  expect(browserOriginAllowed("https://saassuite.ai", null)).toBe(true);
  expect(browserOriginAllowed(null, "https://www.gofreesaas.com/checkout")).toBe(true);
  expect(browserOriginAllowed(null, null)).toBe(false);
  expect(browserOriginAllowed("https://services.leadconnectorhq.com", null)).toBe(false);
  expect(resolvedClientNetwork({
    serviceRole: false,
    origin: "https://saassuite.ai",
    forwardedFor: "198.51.100.4, 10.1.1.1",
    userAgent: "Mozilla/5.0",
  })).toEqual({ clientIp: "198.51.100.4", clientUserAgent: "Mozilla/5.0" });
  expect(resolvedClientNetwork({
    serviceRole: false,
    forwardedFor: "198.51.100.4, 10.1.1.1",
    userAgent: "GHL-Server",
  })).toEqual({});
  expect(resolvedClientNetwork({
    serviceRole: false,
    ghlNormalized: true,
    origin: "https://saassuite.ai",
    forwardedFor: "198.51.100.4",
    userAgent: "GHL-Server",
  })).toEqual({});
  expect(resolvedClientNetwork({
    serviceRole: false,
    origin: "https://services.leadconnectorhq.com",
    forwardedFor: "198.51.100.4",
    userAgent: "GHL-Server",
  })).toEqual({});
  expect(resolvedClientNetwork({
    serviceRole: true,
    origin: "https://saassuite.ai",
    forwardedFor: "198.51.100.4",
    userAgent: "supabase-webhook",
  })).toEqual({});
  expect(resolvedClientNetwork({
    serviceRole: true,
    origin: "https://saassuite.ai",
    clientIp: "203.0.113.8",
    clientUserAgent: "buyer-agent",
    forwardedFor: "198.51.100.4",
  })).toEqual({ clientIp: "203.0.113.8", clientUserAgent: "buyer-agent" });

  const key = "service-role-secret";
  expect(secretEquals(key, key)).toBe(true);
  expect(secretEquals(key, "anon-key")).toBe(false);
  expect(isServiceRoleRequest({ authorization: `Bearer ${key}`, apikey: "anon", serviceRoleKey: key })).toBe(true);
  expect(isServiceRoleRequest({ authorization: "Bearer anon", apikey: "anon", serviceRoleKey: key })).toBe(false);

  expect(authorizePurchase({
    serviceRole: true,
    eventId: "order_cs_live_qa370",
    value: 370,
    stripe: null,
  })).toEqual({ allow: true, value: 370 });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_qa370",
    value: 370,
    stripe: { paid: true, currency: "usd", amountCents: 37000, email: "buyer@example.com" },
  })).toEqual({ allow: true, value: 370, email: "buyer@example.com" });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_pi_launchqa",
    value: 147,
    stripe: { paid: true, currency: "usd", amountCents: 14700, email: "buyer@example.com" },
  }).allow).toBe(true);
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_comped",
    value: 370,
    stripe: { paid: true, currency: "usd", amountCents: 0, email: "buyer@example.com" },
  })).toEqual({ allow: false });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_qa370",
    value: 1,
    stripe: { paid: true, currency: "usd", amountCents: 37000 },
  })).toEqual({ allow: false });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "lead_ofk_abcdef0123456789",
    value: 370,
    stripe: { paid: true, currency: "usd", amountCents: 37000 },
  })).toEqual({ allow: false });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_missing",
    value: 370,
    stripe: null,
  })).toEqual({ allow: false });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_open",
    value: 370,
    stripe: { paid: false, currency: "usd", amountCents: 37000 },
  })).toEqual({ allow: false });
  expect(checkoutPaymentCollected("paid")).toBe(true);
  expect(checkoutPaymentCollected("complete")).toBe(false);
  expect(checkoutPaymentCollected("no_payment_required")).toBe(false);
});

test("a $0 trial checkout is sent at Stripe's plan price", () => {
  expect(isCheckoutTrial({
    mode: "subscription",
    amountCents: 0,
    status: "complete",
    paymentStatus: "no_payment_required",
    trialSource: "onefeature_training_14day",
    subscriptionStatus: "trialing",
  })).toBe(true);
  expect(isCheckoutTrial({
    mode: "subscription",
    amountCents: 0,
    status: "open",
    paymentStatus: "unpaid",
    trialSource: "onefeature_training_14day",
    subscriptionStatus: null,
  })).toBe(false);
  expect(isCheckoutTrial({
    mode: "payment",
    amountCents: 0,
    status: "complete",
    paymentStatus: "paid",
    trialSource: null,
    subscriptionStatus: null,
  })).toBe(false);
  expect(isCheckoutTrial({
    mode: "subscription",
    amountCents: 0,
    status: "complete",
    paymentStatus: "paid",
    trialSource: null,
    subscriptionStatus: null,
  })).toBe(false);
  expect(trialPlanPriceCents([
    { unitAmountCents: 3000, currency: "usd", recurring: false, quantity: 1 },
    { unitAmountCents: 9700, currency: "usd", recurring: true, quantity: 1 },
  ])).toBe(9700);
  expect(trialPlanPriceCents([
    { unitAmountCents: 2700, currency: "usd", recurring: true, quantity: 1 },
  ])).toBe(2700);
  expect(trialPlanPriceCents([
    { unitAmountCents: 3000, currency: "usd", recurring: false, quantity: 1 },
  ])).toBeNull();
  const advanced = { paid: false, currency: "usd", amountCents: 0, email: "trial@example.com", trial: true, planPriceCents: 9700 };
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_trial97",
    value: 97,
    stripe: advanced,
  })).toEqual({ allow: true, value: 97, email: "trial@example.com" });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_trial97",
    value: 99999,
    stripe: advanced,
  })).toEqual({ allow: true, value: 97, email: "trial@example.com" });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_trial27",
    value: 99999,
    stripe: { paid: false, currency: "usd", amountCents: 0, trial: true, planPriceCents: 2700 },
  })).toEqual({ allow: true, value: 27 });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_trial97",
    value: 97,
    stripe: { paid: false, currency: "usd", amountCents: 0, email: "trial@example.com", trial: true },
  })).toEqual({ allow: false });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_cs_live_compedkit",
    value: 97,
    stripe: { paid: true, currency: "usd", amountCents: 0, email: "buyer@example.com", trial: false },
  })).toEqual({ allow: false });
  expect(authorizePurchase({
    serviceRole: false,
    eventId: "order_nosession_1",
    value: 97,
    stripe: { paid: false, currency: "usd", amountCents: 0, trial: true },
  })).toEqual({ allow: false });
});

test("a failed kit Meta Purchase is retried a few times with the same order id", () => {
  const now = Date.parse("2026-10-20T18:00:00.000Z");
  expect(kitMetaRetryOrderId("meta:cs_live_qa370")).toBe("cs_live_qa370");
  expect(kitMetaRetryOrderId("meta:pi_launchqa")).toBe("pi_launchqa");
  expect(kitMetaRetryOrderId("lynkific:cs_live_qa370")).toBeNull();
  expect(kitMetaRetryDue({
    actionKey: "meta:cs_live_qa370",
    completed: false,
    attempts: 0,
    leaseUntilMs: now - 1000,
  }, now)).toBe(true);
  expect(kitMetaRetryDue({
    actionKey: "meta:cs_live_qa370",
    completed: true,
    attempts: 0,
    leaseUntilMs: now - 1000,
  }, now)).toBe(false);
  expect(kitMetaRetryDue({
    actionKey: "meta:cs_live_qa370",
    completed: false,
    attempts: 0,
    leaseUntilMs: now + 60_000,
  }, now)).toBe(false);
  expect(kitMetaRetryDue({
    actionKey: "lynkific:cs_live_qa370",
    completed: false,
    attempts: 0,
    leaseUntilMs: now - 1000,
  }, now)).toBe(false);
  const first = kitMetaRetryPlan(0, now);
  expect(first).toEqual({ attempts: 1, retryAtMs: now + 2 * 60 * 1000, exhausted: false });
  const second = kitMetaRetryPlan(1, now);
  expect(second).toEqual({ attempts: 2, retryAtMs: now + 10 * 60 * 1000, exhausted: false });
  const third = kitMetaRetryPlan(2, now);
  expect(third.attempts).toBe(KIT_META_RETRY_MAX_ATTEMPTS);
  expect(third.exhausted).toBe(true);
  expect(kitMetaRetryDue({
    actionKey: "meta:cs_live_qa370",
    completed: false,
    attempts: third.attempts,
    leaseUntilMs: now - 1000,
  }, now)).toBe(false);
  const retry = readFileSync("supabase/functions/retry-kit-meta-purchases/index.ts", "utf8");
  const sender = readFileSync("supabase/functions/_shared/kit-purchase-send.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20261020234500_kit_meta_purchase_retry.sql", "utf8");
  expect(retry).toContain("sendKitRoutedPurchase");
  expect(sender).toContain("sendMetaPurchase");
  expect(sender).toContain("orderId: input.purchase.orderId");
  expect(retry).toContain("kitMetaRetryPlan");
  expect(retry).not.toContain("event_id:");
  expect(migration).toContain("ADD COLUMN IF NOT EXISTS attempts");
  expect(migration).toContain("retry-kit-meta-purchases");
  expect(migration).toContain("*/2 * * * *");
});

test("ten-digit phones gain a US country code and upsells use their own page", () => {
  expect(metaPhoneDigits("(555) 123-4567")).toBe("15551234567");
  expect(metaPhoneDigits("15551234567")).toBe("15551234567");
  expect(metaPhoneDigits("+44 20 7946 0958")).toBe("442079460958");
  expect(kitUpsellEventSource("launch", "https://saassuite.ai/one-feature-kit/launch-pack?utm_source=facebook")).toBe(
    "https://saassuite.ai/one-feature-kit/launch-pack?utm_source=facebook",
  );
  expect(kitUpsellEventSource("webinar-system", "https://evil.example/one-feature-kit/webinar-sales-system")).toBe(
    "https://saassuite.ai/one-feature-kit/webinar-sales-system",
  );
  expect(kitUpsellEventSource("launch", "")).toBe("https://saassuite.ai/one-feature-kit/launch-pack");
});

test("kit Purchase is wired through the kit webhook and excluded from the subscription webhook", () => {
  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const capi = readFileSync("supabase/functions/meta-capi/index.ts", "utf8");
  const subscription = readFileSync("supabase/functions/stripe-subscription-webhook/index.ts", "utf8");
  const notify = readFileSync("supabase/functions/notify-stripe-purchase/index.ts", "utf8");
  const browser = readFileSync("src/funnel/one-feature-kit/tracking.ts", "utf8");
  expect(webhook).toContain("kitCheckoutMetaPurchase");
  expect(webhook).toContain("kitUpsellMetaPurchase");
  expect(webhook).toContain("kitMetaActionKey");
  expect(webhook).toContain("runMetaPurchaseDelivery");
  expect(webhook).toContain("emitKitPurchase");
  expect(webhook).toContain('console.error("kit meta purchase"');
  expect(webhook).toContain("kitLynkificActionKey");
  expect(webhook).toContain("kit webhook unknown offer");
  expect(webhook).not.toContain("Meta purchase was not accepted");
  expect(payment).toContain("kitStripeTrackingMetadata");
  expect(payment).toContain('pixel_ids: [META_LEAD_PIXEL_ID]');
  expect(payment).toContain('event_name: "InitiateCheckout"');
  expect(payment).toContain("event_name: \"Lead\"");
  expect(payment).toContain("pickKitEventMetadata");
  expect(payment).toContain("scheduleKitCheckoutMeta");
  expect(payment).toContain("EdgeRuntime");
  expect(payment).toContain("waitUntil");
  expect(payment).toContain("kitUpsellEventSource");
  expect(payment).toContain("amountTotal:");
  expect(capi).toContain("InitiateCheckout");
  expect(capi).toContain("ViewContent");
  expect(capi).toContain("AddPaymentInfo");
  expect(capi).toContain("PageView");
  expect(capi).toContain("Purchase must be sent by the server or match a Stripe charge");
  expect(capi).toContain("resolvedClientNetwork");
  expect(capi).toContain("checkoutPaymentCollected");
  expect(capi).toContain("isCheckoutTrial");
  expect(capi).toContain("trialPlanPriceCents");
  expect(capi).toContain("subscription.items.data.price");
  expect(capi).toContain("metaPhoneDigits");
  expect(capi).toContain("ghlNormalized");
  expect(capi).not.toContain('session.status === "complete"');
  const lead = readFileSync("supabase/functions/one-feature-lead/index.ts", "utf8");
  expect(lead).not.toContain("pixel_ids");
  const browserLead = readFileSync("src/components/one-feature/shared.tsx", "utf8");
  expect(browserLead).toContain('fbq("track", "Lead"');
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain("var kitPath = path === '/one-feature-kit' || path.indexOf('/one-feature-kit/') === 0;");
  expect(html.match(/fbq\('track', 'PageView'\)/g)).toHaveLength(1);
  const charge = readFileSync("src/funnel/one-feature-kit/payment.ts", "utf8");
  expect(charge).toContain("page_url: pageUrl");
  expect(capi).toContain("metaCustomData");
  expect(subscription).toContain("isOneFeatureKitFunnel");
  expect(notify).toContain("isOneFeatureKitFunnel");
  expect(browser).toContain("trackSingle");
  expect(browser).toContain("META_LEAD_PIXEL_ID");
  expect(browser).toContain("kitPurchaseEventId");
  expect(browser).not.toContain('event_name: "Purchase"');
});
