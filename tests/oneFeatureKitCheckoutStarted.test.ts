import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { kitTotal } from "../supabase/functions/_shared/kit-catalog";
import {
  KIT_CHECKOUT_PAGE_URL,
  KIT_CHECKOUT_STARTED_WEBHOOK_FALLBACK,
  deliverKitCheckoutStarted,
  kitCheckoutStartedPayload,
  kitCheckoutStartedSkipReason,
  kitCheckoutStartedWebhookUrl,
  queueKitCheckoutStarted,
  type KitCheckoutStartedInput,
  type KitCheckoutStartedPayload,
} from "../supabase/functions/_shared/kit-checkout-started";

const STARTED_AT = "2026-10-21T13:15:00.000Z";

function payload(overrides: Partial<Parameters<typeof kitCheckoutStartedPayload>[0]> = {}): KitCheckoutStartedPayload {
  return kitCheckoutStartedPayload({
    email: "  Ada@Example.com ",
    phone: " +13375551212 ",
    name: "  Ada   Lovelace  ",
    lineIds: ["kit", "bump-replay"],
    amountCentsTotal: kitTotal(["kit", "bump-replay"]),
    promotionCode: null,
    checkoutSessionId: "cs_live_a1b2c3",
    startedAt: STARTED_AT,
    ...overrides,
  });
}

function notice(overrides: Partial<KitCheckoutStartedInput> = {}): KitCheckoutStartedInput {
  return {
    livemode: true,
    email: "ada@example.com",
    phone: "+13375551212",
    name: "Ada Lovelace",
    lineIds: ["kit", "bump-replay"],
    amountCentsTotal: kitTotal(["kit", "bump-replay"]),
    promotionCode: null,
    checkoutSessionId: "cs_live_a1b2c3",
    startedAt: STARTED_AT,
    webhookUrl: undefined,
    ...overrides,
  };
}

test("checkout started payload uses the buyer, the pre-discount total, and the checkout page", () => {
  const lineIds = ["kit", "bump-replay"];
  const built = payload({ lineIds });
  expect(kitTotal(lineIds)).toBe(4400);
  expect(built).toEqual({
    event: "saassuite.kit_checkout_started",
    email: "ada@example.com",
    phone: "+13375551212",
    first_name: "Ada",
    last_name: "Lovelace",
    line_ids: ["kit", "bump-replay"],
    amount_cents_total: 4400,
    promotion_code: null,
    checkout_session_id: "cs_live_a1b2c3",
    checkout_url: "https://saassuite.ai/one-feature-kit/checkout",
    started_at: STARTED_AT,
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    source: "saassuite",
  });
  expect(built.checkout_url).toBe(KIT_CHECKOUT_PAGE_URL);
  lineIds.push("bump-video");
  expect(built.line_ids).toEqual(["kit", "bump-replay"]);

  expect(payload({ name: "Ada", promotionCode: "  SAVE10  ", checkoutSessionId: "pi_live_upsell" })).toMatchObject({
    first_name: "Ada",
    last_name: "",
    promotion_code: "SAVE10",
    checkout_session_id: "pi_live_upsell",
  });
  expect(payload({ promotionCode: "   ", email: "Buyer@Example.com" }).promotion_code).toBeNull();
  expect(payload({ email: "Buyer@Example.com" }).email).toBe("buyer@example.com");

  const tagged = payload({
    utm_source: "  facebook ",
    utm_medium: "paid",
    utm_campaign: `${"k".repeat(250)}`,
    utm_content: " video-ad ",
  });
  expect(tagged.utm_source).toBe("facebook");
  expect(tagged.utm_medium).toBe("paid");
  expect(tagged.utm_campaign).toBe("k".repeat(200));
  expect(tagged.utm_content).toBe("video-ad");
  const unknown = JSON.parse(JSON.stringify(payload({ utm_source: "   ", utm_medium: null }))) as KitCheckoutStartedPayload;
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const) {
    expect(unknown[key]).toBe("");
    expect(Object.hasOwn(unknown, key)).toBe(true);
  }
});

test("checkout started skips test mode, a missing email, FRIENDSINTERNAL, and a blank webhook URL", () => {
  expect(kitCheckoutStartedSkipReason({ livemode: false, email: "ada@example.com", promotionCode: null })).toBe("test-mode");
  expect(kitCheckoutStartedSkipReason({ livemode: true, email: "  ", promotionCode: null })).toBe("missing-email");
  expect(kitCheckoutStartedSkipReason({ livemode: true, email: "", promotionCode: "SAVE10" })).toBe("missing-email");
  for (const code of ["FRIENDSINTERNAL", "friendsinternal", " FriendsInternal "]) {
    expect(kitCheckoutStartedSkipReason({ livemode: true, email: "ada@example.com", promotionCode: code })).toBe("friends-internal");
  }
  expect(kitCheckoutStartedSkipReason({ livemode: true, email: "ada@example.com", promotionCode: "SAVE10" })).toBeNull();
  expect(kitCheckoutStartedSkipReason({ livemode: true, email: "ada@example.com", promotionCode: null })).toBeNull();
  expect(kitCheckoutStartedSkipReason({ livemode: true, email: "ada@example.com", promotionCode: "FRIENDS" })).toBeNull();

  expect(kitCheckoutStartedWebhookUrl(undefined)).toBe(KIT_CHECKOUT_STARTED_WEBHOOK_FALLBACK);
  expect(KIT_CHECKOUT_STARTED_WEBHOOK_FALLBACK).toBe(
    "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/21cf8682-7a42-48fe-917b-5c989453985b",
  );
  expect(kitCheckoutStartedWebhookUrl("")).toBeNull();
  expect(kitCheckoutStartedWebhookUrl("   ")).toBeNull();
  expect(kitCheckoutStartedWebhookUrl(" https://hooks.example/started ")).toBe("https://hooks.example/started");
});

test("a failing or timing-out checkout-started POST does not break create", async () => {
  const calls: string[] = [];
  const failing = await queueKitCheckoutStarted(notice(), {
    post: async () => {
      throw new Error("down");
    },
  });
  expect(failing).toBe("failed");

  const rejected = await queueKitCheckoutStarted(notice({ promotionCode: "SAVE10" }), {
    post: async (url, body) => {
      calls.push(`${url} ${body}`);
      return { ok: false };
    },
  });
  expect(rejected).toBe("failed");
  expect(JSON.parse(calls[0].slice(calls[0].indexOf("{"))).event).toBe("saassuite.kit_checkout_started");

  const started = Date.now();
  let aborted = false;
  let finishHang: (value: { ok: boolean }) => void = () => {};
  const timedOut = await queueKitCheckoutStarted(notice(), {
    timeoutMs: 40,
    post: (_url, _body, signal) => new Promise(resolve => {
      finishHang = resolve;
      signal.addEventListener("abort", () => { aborted = true; });
    }),
  });
  expect(timedOut).toBe("failed");
  expect(aborted).toBe(true);
  expect(Date.now() - started).toBeLessThan(1000);
  finishHang({ ok: false });

  const checkout = { clientSecret: "cs_live_secret_example", sessionId: "cs_live_a1b2c3" };
  const afterFailure = await (async () => {
    const status = await queueKitCheckoutStarted(notice(), {
      post: async () => { throw new Error("still down"); },
    });
    return { checkout, status };
  })();
  expect(afterFailure.status).toBe("failed");
  expect(afterFailure.checkout).toEqual(checkout);

  expect(await queueKitCheckoutStarted(notice({ livemode: false }), {
    post: async () => { throw new Error("should not post"); },
  })).toBe("skipped");
  expect(await queueKitCheckoutStarted(notice({ email: " " }), {
    post: async () => { throw new Error("should not post"); },
  })).toBe("skipped");
  expect(await queueKitCheckoutStarted(notice({ promotionCode: "friendsinternal" }), {
    post: async () => { throw new Error("should not post"); },
  })).toBe("skipped");
  expect(await queueKitCheckoutStarted(notice({ webhookUrl: "" }), {
    post: async () => { throw new Error("should not post"); },
  })).toBe("skipped");

  let postedUrl = "";
  const sent = await queueKitCheckoutStarted(notice({
    webhookUrl: undefined,
    promotionCode: "SAVE10",
    utm_source: " facebook ",
    utm_medium: "",
    utm_campaign: "one-feature-kit",
    utm_content: "video-ad",
  }), {
    post: async (url, body) => {
      postedUrl = url;
      expect(JSON.parse(body)).toMatchObject({
        event: "saassuite.kit_checkout_started",
        email: "ada@example.com",
        promotion_code: "SAVE10",
        amount_cents_total: 4400,
        checkout_url: KIT_CHECKOUT_PAGE_URL,
        utm_source: "facebook",
        utm_medium: "",
        utm_campaign: "one-feature-kit",
        utm_content: "video-ad",
      });
      return { ok: true };
    },
  });
  expect(sent).toBe("sent");
  expect(postedUrl).toBe(KIT_CHECKOUT_STARTED_WEBHOOK_FALLBACK);

  let background: Promise<unknown> | undefined;
  let release: (value: { ok: boolean }) => void = () => {};
  const gate = new Promise<{ ok: boolean }>(resolve => { release = resolve; });
  const queuedAt = Date.now();
  const scheduled = await queueKitCheckoutStarted(notice(), {
    timeoutMs: 5000,
    waitUntil: promise => { background = promise; },
    post: async () => gate,
  });
  expect(scheduled).toBe("scheduled");
  expect(Date.now() - queuedAt).toBeLessThan(200);
  expect({ clientSecret: checkout.clientSecret, sessionId: checkout.sessionId }).toEqual(checkout);
  release({ ok: true });
  expect(await background).toBe("sent");

  expect(await deliverKitCheckoutStarted(payload(), "  ", async () => { throw new Error("no"); })).toBe("skipped");
  expect(await deliverKitCheckoutStarted(payload(), "https://hooks.example/started", async () => { throw new Error("down"); })).toBe("failed");

  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const createStart = payment.indexOf('if (input.action === "create")');
  const verifyStart = payment.indexOf("const verified = await verifiedKitSession");
  const createBody = payment.slice(createStart, verifyStart);
  expect(createBody).toContain("queueKitCheckoutStarted");
  expect(createBody.indexOf("checkout.sessions.create")).toBeLessThan(createBody.indexOf("queueKitCheckoutStarted"));
  expect(createBody.indexOf("queueKitCheckoutStarted")).toBeLessThan(createBody.indexOf("return json({ clientSecret:"));
  expect(createBody).toContain('Deno.env.get("KIT_CHECKOUT_STARTED_WEBHOOK_URL")');
  expect(createBody).toContain("kitTotal(ids)");
  expect(createBody).toContain("session.livemode === true");
  expect(createBody).toContain("await checkoutStarted");
  expect(createBody).toContain("const utms = kitUtmFields(");
  expect(createBody).toContain("input.utm_source ?? input.tracking?.utm_source");
  expect(createBody).toContain("...kitUtmMetadata(utms)");
  expect(createBody).toContain("utm_source: utms.utm_source");
  expect(createBody).toContain("utm_content: utms.utm_content");
  expect(createBody.indexOf("...trackingMeta")).toBeLessThan(createBody.indexOf("...kitUtmMetadata(utms)"));
});
