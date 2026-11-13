import { existsSync, readFileSync } from "fs";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createElement } from "react";
import {
  FRIENDS_INTERNAL_PROMOTION_CODE_ID,
  KIT_PROMO_INVALID,
  activeKitPromotionId,
  assertKitPaid,
  kitCheckoutPromoFields,
  KIT_CUSTOMER_COPY,
  kitDiscountedCents,
  kitPromoQuote,
  kitTotal,
} from "../supabase/functions/_shared/kit-catalog";
import { KIT_BASIC_TRIAL_DAYS, KIT_BASIC_TRIAL_SOURCE, kitBasicAccessUpdate, kitBasicGrant, kitBasicTrialEnded } from "../supabase/functions/_shared/kit-basic";
import { skipCheckoutPurchase } from "../supabase/functions/_shared/meta-purchase-guard";
import {
  attachPurchasesByEmail,
  checkoutEntitlementRows,
  kitCheckoutSettlement,
  mergeKitPurchases,
  saveKitEntitlements,
  upsellChargeMode,
  upsellEntitlementRow,
  type KitCheckoutSession,
  type KitPurchaseRow,
} from "../supabase/functions/_shared/kit-entitlements";
import {
  KIT_DASHBOARD_PATH,
  KIT_DELIVERABLES,
  KIT_REPLAY_URL,
  KIT_SALES_PAGE_URL,
  KIT_TRAINING_URL,
  KIT_WEBINAR_URL,
  kitAuthDestination,
  kitBuyerHasPassword,
  kitSignInHref,
  kitDeliveryState,
  unlinkedKitDeliverables,
} from "../src/lib/kitDelivery";
import {
  KIT_AD_TEMPLATE_COUNT,
  KIT_AD_TEMPLATES,
  KIT_BASE_AD_TEMPLATE_ID,
  allowedKitAdTemplateIds,
} from "../src/lib/kitAdTemplates";
import { AFFILIATE_SALES_PAGES, affiliateShareUrl } from "../src/lib/affiliateOffers";
import { deliverKitBuyerLogin, issueKitLoginLink, kitBuyerSignInUrl, KIT_LOGIN_REDIRECT, kitLoginHtml } from "../supabase/functions/_shared/kit-login";
import { KIT_GHL_LOCATION_ID, KIT_LYNKIFIC_WEBHOOK_FALLBACK, deliverLynkificKitPurchase, kitGhlLocationId, kitLynkificWebhookUrl, kitPromotionCode, kitPurchasedPayload, kitPurchasedSamplePayload, kitPurchasedWebhookUrl, runLynkificDelivery } from "../supabase/functions/_shared/kit-lynkific";
import { KitDeliveryList } from "../src/components/dashboard/OneFeatureKitDelivery";
import { WL_SALES_VIDEO } from "../src/components/one-feature/shared";
import { WALKTHROUGH_VIDEO } from "../src/lib/startHere";

const promo = [{ promotion_code: FRIENDS_INTERNAL_PROMOTION_CODE_ID }];

function session(overrides: Partial<KitCheckoutSession> = {}): KitCheckoutSession {
  return {
    metadata: {
      funnel: "one-feature-kit",
      line_ids: "kit,bump-replay",
      email: "Buyer@Example.com",
      name: "Ada",
      phone: "3372270501",
    },
    payment_status: "paid",
    amount_total: 4400,
    currency: "usd",
    mode: "payment",
    livemode: true,
    customer: "cus_test",
    payment_intent: { id: "pi_test", status: "succeeded", payment_method: "pm_test" },
    customer_details: { email: "Buyer@Example.com" },
    ...overrides,
  };
}

test("a paid checkout becomes one entitlement row per line", () => {
  const rows = checkoutEntitlementRows(session(), "cs_live_paid");
  expect(rows.map(row => row.line_id)).toEqual(["kit", "bump-replay"]);
  expect(rows.every(row => row.email === "buyer@example.com")).toBe(true);
  expect(rows.every(row => row.stripe_customer_id === "cus_test")).toBe(true);
  expect(rows.every(row => row.checkout_session_id === "cs_live_paid")).toBe(true);
  expect(rows.every(row => row.payment_intent_id === "pi_test")).toBe(true);
  expect(rows.reduce((sum, row) => sum + row.amount_cents, 0)).toBe(4400);
  expect(rows.every(row => row.comped === false)).toBe(true);
});

test("replaying the same checkout does not add rows", async () => {
  const store: KitPurchaseRow[] = [];
  const db = {
    from(table: string) {
      expect(table).toBe("kit_purchases");
      return {
        upsert: async (rows: KitPurchaseRow[]) => {
          const next = mergeKitPurchases(store, rows);
          store.splice(0, store.length, ...next);
          return { error: null };
        },
      };
    },
  };
  const rows = checkoutEntitlementRows(session(), "cs_live_paid");
  await saveKitEntitlements(db, rows);
  await saveKitEntitlements(db, rows);
  expect(store).toHaveLength(2);
  expect(mergeKitPurchases(store, rows)).toHaveLength(2);
});

test("a $0 FRIENDSINTERNAL session with no PaymentIntent is still paid", () => {
  const zero = session({
    amount_total: 0,
    discounts: promo,
    payment_intent: null,
    metadata: { funnel: "one-feature-kit", line_ids: "kit", email: "fresh@example.com" },
  });
  expect(assertKitPaid(zero)).toEqual(["kit"]);
  const settlement = kitCheckoutSettlement(zero);
  expect(settlement.comped).toBe(true);
  expect(settlement.paymentIntentId).toBeNull();
  expect(settlement.paymentMethodId).toBeNull();
  const rows = checkoutEntitlementRows(zero, "cs_live_zero");
  expect(rows).toHaveLength(1);
  expect(rows[0].amount_cents).toBe(0);
  expect(rows[0].comped).toBe(true);
  expect(rows[0].promotion_code_id).toBe(FRIENDS_INTERNAL_PROMOTION_CODE_ID);
  expect(rows[0].payment_intent_id).toBeNull();
  expect(kitTotal(["kit"])).toBe(2700);
});

test("a $0 session without that promotion code is not paid", () => {
  const zero = session({ amount_total: 0, payment_intent: null, discounts: [] });
  expect(() => assertKitPaid(zero)).toThrow("Payment amount does not match");
});

test("a saved card on a promo session still charges the upsell", () => {
  const withCard = kitCheckoutSettlement(session({
    amount_total: 0,
    discounts: promo,
    payment_intent: null,
    setup_intent: { id: "seti_test", payment_method: "pm_saved" },
    metadata: { funnel: "one-feature-kit", line_ids: "kit", email: "fresh@example.com" },
  }));
  expect(upsellChargeMode(withCard)).toBe("charge");
  const noCard = kitCheckoutSettlement(session({
    amount_total: 0,
    discounts: promo,
    payment_intent: null,
    metadata: { funnel: "one-feature-kit", line_ids: "kit", email: "fresh@example.com" },
  }));
  expect(upsellChargeMode(noCard)).toBe("comped");
  const comped = upsellEntitlementRow(session({
    amount_total: 0,
    discounts: promo,
    payment_intent: null,
    metadata: { funnel: "one-feature-kit", line_ids: "kit", email: "fresh@example.com" },
  }), "cs_live_zero", "launch", null, true);
  expect(comped.amount_cents).toBe(0);
  expect(comped.payment_intent_id).toBeNull();
  expect(comped.line_id).toBe("launch");
  expect(comped.source).toBe("upsell");
});

test("signup and login attach purchases only for the same email", () => {
  const rows = [
    { email: "buyer@example.com", user_id: null, line_id: "kit" },
    { email: "other@example.com", user_id: null, line_id: "kit" },
  ];
  const attached = attachPurchasesByEmail(rows, "Buyer@Example.com", "user-1");
  expect(attached[0].user_id).toBe("user-1");
  expect(attached[1].user_id).toBeNull();
  const signup = readFileSync("src/pages/Signup.tsx", "utf8");
  const login = readFileSync("src/pages/Login.tsx", "utf8");
  const session = readFileSync("src/contexts/UserContext.tsx", "utf8");
  expect(signup).toContain("attachKitPurchases()");
  expect(login).toContain("attachKitPurchases()");
  expect(session).toContain("attachKitPurchases()");
  expect(kitAuthDestination("Buyer@Example.com", false)).toBe(
    `/signup?email=buyer%40example.com&next=${encodeURIComponent(KIT_DASHBOARD_PATH)}`,
  );
  expect(kitAuthDestination("buyer@example.com", true)).toContain("/login?email=");
  expect(kitBuyerHasPassword([{ has_password: true }], null)).toBe(true);
  expect(kitBuyerHasPassword([{ has_password: false }], null)).toBe(false);
  expect(kitBuyerHasPassword(null, null)).toBe(false);
  expect(kitBuyerHasPassword([], { message: "down" })).toBe(false);
  expect(kitSignInHref("Buyer@Example.com", true)).toBe(
    `https://saassuite.ai/login?email=buyer%40example.com&next=${encodeURIComponent(KIT_DASHBOARD_PATH)}`,
  );
  expect(kitSignInHref("Buyer@Example.com", false)).toBe(
    `https://saassuite.ai/signup?email=buyer%40example.com&next=${encodeURIComponent(KIT_DASHBOARD_PATH)}`,
  );
  expect(KIT_LOGIN_REDIRECT).toBe("https://saassuite.ai/app/dashboard?view=kit");
});

test("a confirmed kit checkout invites the buyer and links their purchases", async () => {
  const calls: string[] = [];
  const admin = {
    generateLink: async (args: { type: string; options: { redirectTo: string } }) => {
      calls.push(args.type);
      expect(args.options.redirectTo).toBe(KIT_LOGIN_REDIRECT);
      if (args.type === "invite") return { data: null, error: { message: "already registered" } };
      return { data: { properties: { action_link: "https://auth.example/verify?token=1" }, user: { id: "user-9" } }, error: null };
    },
  };
  expect((await issueKitLoginLink(admin, "Buyer@Example.com", "Ada")).userId).toBe("user-9");
  expect(calls).toEqual(["invite", "magiclink"]);
  expect(kitLoginHtml("A<da", "https://auth.example/verify?a=1&b=2")).toContain("Hi A&lt;da,");
  expect(kitLoginHtml("A<da", "https://auth.example/verify?a=1&b=2")).toContain("href=\"https://auth.example/verify?a=1&amp;b=2\"");

  const linked: { email: string; userId: string }[] = [];
  const released: string[] = [];
  const completed: string[] = [];
  let claimed = false;
  const result = await deliverKitBuyerLogin({
    checkoutId: "cs_live_test",
    email: "Buyer@Example.com",
    name: "Ada",
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    readClaim: async () => ({ completed: completed.length > 0 }),
    releaseClaim: async (key) => { released.push(key); },
    completeClaim: async (key) => { completed.push(key); },
    admin,
    ensureStarter: async () => {},
    linkUser: async (email, userId) => { linked.push({ email, userId }); },
  });
  expect(result.emailed).toBe(false);
  expect(result.actionLink).toBe("https://auth.example/verify?token=1");
  expect(result.signInUrl).toContain("buyer%40example.com");
  expect(linked).toEqual([{ email: "buyer@example.com", userId: "user-9" }]);
  expect(completed).toEqual([]);
  expect(released).toEqual([]);

  expect(kitBuyerSignInUrl("Buyer@Example.com")).toBe(kitSignInHref("Buyer@Example.com", false));
  const payload = kitPurchasedPayload({
    email: "Buyer@Example.com",
    phone: "+13375551212",
    name: "Ada Lovelace",
    lineIds: ["kit", "bump-install"],
    amountCentsTotal: 0,
    comped: true,
    promotionCode: kitPromotionCode([{ promotion_code: { id: "promo_1UL6f9GdZ9PRE3Zi3QN6m5X0", code: "FRIENDSINTERNAL" } }]),
    checkoutSessionId: "cs_live_example",
    loginUrl: "https://auth.example/verify?token=1",
    purchasedAt: "2026-10-20T18:03:13.000Z",
  });
  expect(payload).toMatchObject({
    event: "saassuite.kit_purchased",
    email: "buyer@example.com",
    phone: "+13375551212",
    first_name: "Ada",
    last_name: "Lovelace",
    full_name: "Ada Lovelace",
    line_ids: ["kit", "bump-install"],
    amount_cents_total: 0,
    order_total: 0,
    comped: true,
    promotion_code: "FRIENDSINTERNAL",
    stripe_session_id: "cs_live_example",
    checkout_session_id: "cs_live_example",
    login_url: "https://auth.example/verify?token=1",
    magic_link: "",
    purchased_at: "2026-10-20T18:03:13.000Z",
    items_summary: "The GoHighLevel One Feature Kit ($27)<br>Done-For-You Installation and Setup ($299)",
    has_kit: true,
    has_install_bump: true,
    has_video_bump: false,
    has_replay_bump: false,
    source: "saassuite",
  });
  expect(kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "+13375551212",
    name: "Ada Lovelace",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_example",
    loginUrl: null,
    purchasedAt: "2026-10-20T18:03:13.000Z",
    utm_source: " facebook ",
    utm_medium: "paid",
    utm_campaign: "one-feature-kit",
    utm_content: ` ${"c".repeat(210)} `,
  })).toMatchObject({
    event: "saassuite.kit_purchased",
    utm_source: "facebook",
    utm_medium: "paid",
    utm_campaign: "one-feature-kit",
    utm_content: "c".repeat(200),
  });
  expect(kitPromotionCode([{ promotion_code: "promo_1UL6f9GdZ9PRE3Zi3QN6m5X0" }])).toBe("promo_1UL6f9GdZ9PRE3Zi3QN6m5X0");
  const posts: string[] = [];
  const mailable = { ...payload, magic_link: "https://auth.example/verify?token=1" };
  expect(await deliverLynkificKitPurchase(payload, undefined, async () => { throw new Error("no"); })).toBe("skipped");
  expect(await deliverLynkificKitPurchase(payload, "  ", async () => { throw new Error("no"); })).toBe("skipped");
  expect(await deliverLynkificKitPurchase(mailable, "https://hooks.example/kit", async (_url, body) => {
    posts.push(body);
    return { ok: false };
  })).toBe("uncertain");
  expect(JSON.parse(posts[0]).event).toBe("saassuite.kit_purchased");
  expect(await deliverLynkificKitPurchase(mailable, "https://hooks.example/kit", async () => { throw new Error("down"); })).toBe("uncertain");
  expect(released).toEqual([]);

  const checkout = readFileSync("src/funnel/one-feature-kit/markup/checkout.html", "utf8");
  expect(checkout).toContain("Phone (required)");
  expect(checkout).toContain('id="ofk-phone"');
  expect(checkout).toContain('aria-required="true"');
  const thanks = readFileSync("src/funnel/one-feature-kit/markup/thankyou.html", "utf8");
  expect(thanks).toContain('id="ofk-open-kit"');
  expect(thanks).toContain("https://saassuite.ai/signup?next=%2Fapp%2Fdashboard%3Fview%3Dkit");
  expect(thanks).toContain("No email required");
  expect(thanks).not.toContain("Login already in your inbox");
  expect(thanks).not.toContain("Check your email");
  expect(thanks).not.toContain("on the way");
  expect(readFileSync("src/pages/Signup.tsx", "utf8")).toContain("attachKitPurchases");
  expect(readFileSync("src/contexts/UserContext.tsx", "utf8")).toContain("attachKitPurchases");
  expect(readFileSync("src/components/dashboard/OneFeatureKitDelivery.tsx", "utf8")).toContain('.eq("email", email.trim().toLowerCase())');
  const kitRows = readFileSync("supabase/migrations/20261020144206_kit_purchases.sql", "utf8");
  expect(kitRows).toContain("kit_purchases_attach_own");
  expect(kitRows).toContain("email = lower(coalesce(auth.jwt() ->> 'email', ''))");
  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  expect(webhook).toContain("sendKitBuyerLogin");
  expect(webhook).toContain("GHL_KIT_PURCHASED_WEBHOOK_URL");
  expect(webhook).toContain("kitPurchasedWebhookUrl");
  expect(webhook).toContain('templateKey: "kit_login"');
  expect(webhook).toContain("body, signal");
  expect(webhook).toContain("...kitUtmFields(checkout.metadata)");
  expect(webhook.indexOf("await saveKitEntitlements")).toBeLessThan(webhook.indexOf("await runLynkificDelivery"));
  expect(webhook.indexOf("await sendKitBuyerLogin")).toBeLessThan(webhook.indexOf("await runLynkificDelivery"));
  expect(webhook).toContain("markKitLoginCompleted");
  expect(payment).not.toContain("sendKitBuyerLogin");
  expect(payment).not.toContain("api.resend.com");
  expect(payment).not.toContain("RESEND_API_KEY");
  expect(payment).toContain("prepareKitBuyer");
  const kitPayment = readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8");
  expect(kitPayment).not.toContain("RESEND_API_KEY");
  expect(kitPayment).not.toContain("api.resend.com");
});

test("an unset kit purchase webhook uses the GoHighLevel hook, and a blank value or a slow POST does not hang", async () => {
  expect(kitLynkificWebhookUrl(undefined)).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  expect(KIT_LYNKIFIC_WEBHOOK_FALLBACK).toBe(
    "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/d9553c9e-6631-48e2-83d2-3a7d0e5c5ab8",
  );
  expect(kitLynkificWebhookUrl("")).toBeNull();
  expect(kitLynkificWebhookUrl("   ")).toBeNull();
  expect(kitLynkificWebhookUrl(" https://hooks.example/kit ")).toBe("https://hooks.example/kit");
  expect(kitPurchasedWebhookUrl(undefined, undefined)).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  expect(kitPurchasedWebhookUrl("", "")).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  expect(kitPurchasedWebhookUrl(" https://hooks.example/purchased ", "")).toBe("https://hooks.example/purchased");
  expect(kitGhlLocationId(KIT_LYNKIFIC_WEBHOOK_FALLBACK)).toBe(KIT_GHL_LOCATION_ID);
  const sameLocation = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const otherLocation = "https://services.leadconnectorhq.com/hooks/OtherLocationId/webhook-trigger/d9553c9e-6631-48e2-83d2-3a7d0e5c5ab8";
  expect(kitPurchasedWebhookUrl("https://ghl.example/new", sameLocation)).toBe(sameLocation);
  expect(kitPurchasedWebhookUrl("https://ghl.example/new", `  ${KIT_LYNKIFIC_WEBHOOK_FALLBACK}  `)).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  expect(kitPurchasedWebhookUrl("https://ghl.example/new", otherLocation)).toBe("https://ghl.example/new");
  expect(kitPurchasedWebhookUrl(undefined, otherLocation)).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  expect(kitPurchasedWebhookUrl("", "https://hooks.example/not-ghl")).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  const sample = kitPurchasedSamplePayload("andrew+kittest@dna-media.net");
  expect(sample.order_total).toBe(71);
  expect(sample.event).toBe("saassuite.kit_purchased");
  expect(sample.login_url).toContain("andrew%2Bkittest%40dna-media.net");
  expect(sample.magic_link).toBe(sample.login_url);
  expect(sample.magic_link.startsWith("https://")).toBe(true);
  expect(sample.stripe_session_id).toBe("cs_test_kit_purchased_sample");
  expect(sample.checkout_session_id).toBe("cs_test_kit_purchased_sample");
  expect(sample.items_summary).toBe(
    "The GoHighLevel One Feature Kit ($27)<br>Full 90-Minute Training Replay ($17)<br>Done-For-You Branded AI Studio Sales Video ($27)",
  );
  expect(sample.has_video_bump).toBe(true);
  expect(sample.has_replay_bump).toBe(true);
  expect(sample.line_ids).toEqual(["kit", "bump-replay", "bump-video"]);

  const payload = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "+13375551212",
    name: "Ada Lovelace",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_example",
    loginUrl: "https://saassuite.ai/signup?email=buyer%40example.com",
    magicLink: "https://auth.example/verify?token=1",
    purchasedAt: "2026-10-20T18:03:13.000Z",
  });
  let posted = "";
  let completed = false;
  const sent = await runLynkificDelivery({
    claimed: true,
    completed: false,
    payload,
    url: kitLynkificWebhookUrl(undefined),
    post: async (url) => {
      posted = url;
      return { ok: true };
    },
    release: async () => { throw new Error("should not release"); },
    complete: async () => { completed = true; },
  });
  expect(sent).toBe("sent");
  expect(posted).toBe(KIT_LYNKIFIC_WEBHOOK_FALLBACK);
  expect(completed).toBe(true);
  expect(await deliverLynkificKitPurchase(payload, kitLynkificWebhookUrl(""), async () => { throw new Error("no"); })).toBe("skipped");
  expect(await deliverLynkificKitPurchase(payload, kitLynkificWebhookUrl("   "), async () => { throw new Error("no"); })).toBe("skipped");

  const started = Date.now();
  let aborted = false;
  const timedOut = await deliverLynkificKitPurchase(
    payload,
    KIT_LYNKIFIC_WEBHOOK_FALLBACK,
    (_url, _body, signal) => new Promise(() => {
      signal.addEventListener("abort", () => { aborted = true; });
    }),
    40,
  );
  expect(timedOut).toBe("uncertain");
  expect(aborted).toBe(true);
  expect(Date.now() - started).toBeLessThan(1000);

  let released = false;
  const retryable = await runLynkificDelivery({
    claimed: true,
    completed: false,
    payload,
    url: kitLynkificWebhookUrl(undefined),
    timeoutMs: 40,
    post: (_url, _body, signal) => new Promise(() => {
      signal.addEventListener("abort", () => { aborted = true; });
    }),
    release: async () => { released = true; },
    complete: async () => { throw new Error("should not complete"); },
  });
  expect(retryable).toBe("failed");
  expect(released).toBe(false);
});

test("the delivery page unlocks only what was purchased", () => {
  const partial = kitDeliveryState(["kit", "bump-replay"]);
  const byId = Object.fromEntries(partial.map(item => [item.id, item.unlocked]));
  expect(byId["white-label-video"]).toBe(true);
  expect(byId["snapshot"]).toBe(true);
  expect(byId["bump-replay"]).toBe(true);
  expect(byId["bump-video"]).toBe(false);
  expect(byId["bump-install"]).toBe(false);
  expect(byId["launch"]).toBe(false);
  expect(byId["webinar-system"]).toBe(false);

  const full = kitDeliveryState(KIT_DELIVERABLES.map(item => item.lineId));
  expect(full.every(item => item.unlocked)).toBe(true);

  const none = kitDeliveryState([]);
  expect(none.every(item => !item.unlocked)).toBe(true);

  const partialHtml = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(KitDeliveryList, { lineIds: ["kit", "bump-install"] })),
  );
  expect(partialHtml).toContain("One Feature Training");
  expect(partialHtml).toContain("Install SaaSSuite");
  expect(partialHtml).toContain("Mark complete");
  expect(partialHtml).toContain('data-kit-progress="0/8"');
  expect(partialHtml).not.toContain("Watch the 90-minute training");
  expect(partialHtml).not.toContain("The $27 GoHighLevel One Feature Kit is one offer");
  expect(partialHtml).toContain("Open the intake form");
  expect(partialHtml).toContain("Buy · $17");
  expect(partialHtml).toContain("Buy · $97");
  expect(partialHtml).toContain("Buy · $147");
  expect(partialHtml).toContain('href="/one-feature-kit/webinar-sales-system"');
  expect(partialHtml).not.toContain("getviralmeetings.com");
  expect(partialHtml).toContain('data-kit-unlocked="yes"');
  expect(partialHtml).toContain('data-kit-unlocked="no"');

  const fullHtml = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(KitDeliveryList, {
      lineIds: ["kit", "bump-replay", "bump-video", "bump-install", "launch", "webinar-system"],
    })),
  );
  expect(fullHtml).toContain("Watch the 90-minute training");
  expect(fullHtml).toContain('data-kit-progress="0/9"');
  expect(fullHtml).toContain("What&#x27;s next");
  expect(fullHtml).not.toContain("Buy ·");
  expect(fullHtml).toContain("Confirmed");
  expect(fullHtml).toContain("In progress");
  const webinarTraining = fullHtml.match(
    /<a[^>]*href="https:\/\/getviralmeetings\.com"[^>]*>Open the training/,
  );
  expect(webinarTraining?.[0]).toContain('target="_blank"');
  expect(webinarTraining?.[0]).toContain('rel="noreferrer"');
  expect(fullHtml).not.toContain("saassuite.ai/webinar-sales-system");
  expect(fullHtml).not.toContain("/one-feature-kit/webinar-sales-system");
});

test("deliverable links are the ones already in the repo", () => {
  const byId = Object.fromEntries(KIT_DELIVERABLES.map(item => [item.id, item]));
  expect(byId["white-label-video"].href).toBe(WL_SALES_VIDEO);
  expect(byId["snapshot"].href).toBeNull();
  expect(byId["instructional-video"].href).toBe(WALKTHROUGH_VIDEO);
  expect(byId["menu-link-removal"].href).toBe("/app/streamline");
  expect(byId["copilot"].href).toBe("/app/copilot");
  expect(byId.training.href).toBe(KIT_TRAINING_URL);
  expect(byId["sales-page"].href).toBe(KIT_SALES_PAGE_URL);
  expect(readFileSync("src/funnel/one-feature-kit/markup/sales-above.html", "utf8")).toContain(KIT_SALES_PAGE_URL);
  expect(readFileSync("src/App.tsx", "utf8")).toContain('path="/app/copilot"');
  expect(byId["bump-replay"].href).toBe(KIT_REPLAY_URL);
  expect(KIT_WEBINAR_URL).toBe("https://getviralmeetings.com");
  expect(byId["webinar-system"].href).toBe(KIT_WEBINAR_URL);
  expect(byId["webinar-system"].action).toBe("Open the training");
  expect(byId["webinar-system"].buyHref).toBe("/one-feature-kit/webinar-sales-system");
  expect(byId["ad-template"].href).toBe("/kit/ad-templates/highlevel/vibe-code-for-free.png");
  expect(unlinkedKitDeliverables()).toEqual([
    "SaaSSuite Basic for 30 days",
    "Done-for-you branded AI Studio video",
    "DFY installation, customization, and setup",
  ]);
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  expect(payment).toContain("promotionCodes.list");
  expect(payment).toContain("active: true");
  expect(payment).toContain("kitCheckoutPromoFields(promotionCodeId)");
  expect(payment).toContain('action: z.literal("promo")');
  expect(payment).toContain("kitPromoQuote");
  expect(payment).toContain("percentOff: quote.percentOff");
  expect(payment).not.toContain("payment_method_collection");
  expect(payment).toContain("idempotencyKey: `${key}:checkout3`");
  expect(payment).toContain('ui_mode: "embedded"');
  expect(payment).toContain("clientSecret: session.client_secret");
  expect(payment).toContain("ghl-signup-and-upgrade?session_id={CHECKOUT_SESSION_ID}");
  expect(payment).not.toContain("success_url");
  expect(payment).not.toContain("allow_promotion_codes: true");
  expect(payment).toContain('upsellChargeMode(verified) === "comped"');
  expect(readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8")).toContain("saveKitEntitlements");
});

test("a checkout code becomes a promotion-code discount, and a blank box leaves Stripe's field on", () => {
  expect(activeKitPromotionId(
    [{ id: FRIENDS_INTERNAL_PROMOTION_CODE_ID, active: true, code: "FRIENDSINTERNAL" }],
    "friendsinternal",
  )).toBe(FRIENDS_INTERNAL_PROMOTION_CODE_ID);
  expect(() => activeKitPromotionId([], "FRIENDSINTERNAL")).toThrow(KIT_PROMO_INVALID);
  expect(() => activeKitPromotionId(
    [{ id: "promo_inactive", active: false, code: "FRIENDSINTERNAL" }],
    "FRIENDSINTERNAL",
  )).toThrow(KIT_PROMO_INVALID);
  expect(() => activeKitPromotionId(
    [{ id: "promo_other", active: true, code: "OTHER" }],
    "FRIENDSINTERNAL",
  )).toThrow(KIT_PROMO_INVALID);

  const discounted = kitCheckoutPromoFields(FRIENDS_INTERNAL_PROMOTION_CODE_ID);
  expect(discounted).toEqual({ discounts: [{ promotion_code: FRIENDS_INTERNAL_PROMOTION_CODE_ID }] });
  expect(discounted).not.toHaveProperty("allow_promotion_codes");
  const open = kitCheckoutPromoFields(null);
  expect(open).toEqual({ allow_promotion_codes: true });
  expect(open).not.toHaveProperty("discounts");

  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const client = readFileSync("src/funnel/one-feature-kit/payment.ts", "utf8");
  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  expect(payment).toContain("promotionCodeId");
  expect(payment).toContain("KIT_PROMO_INVALID");
  expect(client).toContain('action: "promo"');
  expect(client).toContain("promotionCode: code");
  expect(kitPromoQuote({ percent_off: 100, amount_off: null, valid: true })).toEqual({ percentOff: 100, amountOff: null });
  expect(kitPromoQuote("YEYMmHpf")).toEqual({ percentOff: null, amountOff: null });
  expect(kitDiscountedCents(37000, { percentOff: 100, amountOff: null })).toBe(0);
  expect(kitDiscountedCents(37000, { percentOff: null, amountOff: 1700 })).toBe(35300);
  expect(kitDiscountedCents(2700, null)).toBe(2700);
  expect(wire).toContain("lookupKitPromotion(code)");
  expect(wire).toContain("kitDiscountedCents");
  expect(wire).toContain("root.dataset.ofkPromo");
  expect(wire).toContain("createKitCheckout(contact, bumps, promotionCode)");
  expect(wire).toContain("message === KIT_PROMO_INVALID");
  const checkout = readFileSync("src/funnel/one-feature-kit/markup/checkout.html", "utf8");
  const checkoutCopy = readFileSync("src/funnel/one-feature-kit/copy/checkout.ts", "utf8");
  expect(checkoutCopy).toContain("Complete my order opens secure checkout on this page.");
  expect(checkout).toContain('id="ofk-pay"');
  expect(checkout).not.toContain("prices are connected");
  expect(wire).not.toContain("No discount was applied");
  expect(wire.indexOf("openKitEmbeddedCheckout(clientSecret)")).toBeGreaterThan(wire.indexOf("createKitCheckout(contact, bumps, promotionCode)"));
  expect(wire).toContain("askKitChargeConfirm(kitChargeConfirmCopy(offer.amountCents), offer.label)");
  expect(wire).toContain("showKitChargeSuccess(offer.label)");
  expect(readFileSync("src/funnel/one-feature-kit/copy/thankYou.ts", "utf8")).toContain("team@yoursoftwareonboarding.com");
  expect(readFileSync("src/funnel/one-feature-kit/markup/thankyou.html", "utf8")).not.toContain("team@yoursoftwareonboarding.com");
  expect(wire).toContain("applyThankYouCopy");
  expect(wire).toContain('closest("#ofk-copy-team")');
});

test("the ad library unlocks the vibe template with the kit and every creative with the Launch Pack", () => {
  expect(KIT_AD_TEMPLATE_COUNT).toBe(17);
  expect(KIT_AD_TEMPLATES.filter(item => item.kind === "video")).toHaveLength(1);
  expect(KIT_AD_TEMPLATES.filter(item => item.kind === "image")).toHaveLength(16);
  expect(KIT_AD_TEMPLATES.filter(item => item.inKit).map(item => item.id)).toEqual([KIT_BASE_AD_TEMPLATE_ID]);
  expect(allowedKitAdTemplateIds(["kit"])).toEqual([KIT_BASE_AD_TEMPLATE_ID]);
  expect(allowedKitAdTemplateIds(["launch"])).toHaveLength(17);
  expect(allowedKitAdTemplateIds([])).toEqual([]);
  for (const item of KIT_AD_TEMPLATES) {
    expect(existsSync(`public${item.src}`)).toBe(true);
    expect(item.prompt).toContain("[YOUR BUSINESS NAME]");
    expect(item.prompt).toContain("[YOUR OFFER]");
    expect(item.prompt).toContain("5 distinct variations");
  }
  const gusto = KIT_AD_TEMPLATES.find(item => item.id === "gusto-payroll");
  expect(gusto?.kind).toBe("video");
  expect(gusto?.prompt).toContain("Run payroll as many times as you need.");
  expect(gusto?.poster && existsSync(`public${gusto.poster}`)).toBe(true);

  const kitHtml = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(KitDeliveryList, { lineIds: ["kit"] })),
  );
  expect(kitHtml).toContain('data-kit-template="vibe-code-for-free" data-kit-template-unlocked="yes"');
  expect(kitHtml).toContain('data-kit-template="gusto-payroll" data-kit-template-unlocked="no"');
  expect(kitHtml).toContain("60 Day Free Trial");
  expect(kitHtml).toContain("/one-feature-kit/launch-pack");
  expect(kitHtml).not.toContain("Run payroll as many times as you need.");
  expect(kitHtml).toContain('data-testid="kit-ad-request"');
  expect(kitHtml).toContain("17 creatives");

  const launchHtml = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(KitDeliveryList, { lineIds: ["launch"] })),
  );
  expect(launchHtml).toContain("Run payroll as many times as you need.");
  expect(launchHtml).not.toContain('data-kit-template-unlocked="no"');
  expect(launchHtml).toContain("Ad Library (17)");
  expect(launchHtml).toContain('aria-expanded="false"');
  expect(launchHtml).toContain("Download all");
  expect(kitHtml).toContain("Ad Library (17)");

  const fn = readFileSync("supabase/functions/kit-ad-customization/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20261020152401_kit_ad_requests.sql", "utf8");
  expect(fn).toContain('event_type: "kit_ad_customization_request"');
  expect(fn).toContain('Deno.env.get("KIT_SLACK_AGENCY_ID")');
  expect(fn).toContain('from("kit_ad_requests")');
  expect(fn).toContain('from("kit-ad-logos")');
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("user_id = auth.uid()");
  expect(migration).toContain("'kit-ad-logos'");
  expect(readFileSync("src/funnel/one-feature-kit/markup/launch.html", "utf8")).toContain("25");
});

test("the affiliate switcher carries the One Feature Kit ref link", () => {
  const kit = AFFILIATE_SALES_PAGES.find(page => page.id === "one-feature-kit");
  expect(kit).toEqual({ id: "one-feature-kit", label: "One Feature Kit", path: "/one-feature-kit" });
  expect(affiliateShareUrl("/one-feature-kit", "northstar")).toBe(
    "https://saassuite.ai/one-feature-kit?ref=northstar",
  );
  expect(affiliateShareUrl("/", "northstar")).toBe("https://saassuite.ai/?ref=northstar");
  const dashboard = readFileSync("src/components/AffiliateDashboard.tsx", "utf8");
  expect(dashboard).toContain("AFFILIATE_SALES_PAGES");
  expect(dashboard).toContain("affiliateShareUrl");
  expect(readFileSync("src/components/Dashboard.tsx", "utf8")).toContain('value="kit"');
});

test("a zero total or a 100 percent promo skips the Meta Purchase", () => {
  expect(skipCheckoutPurchase({ amount_total: 0, amount_subtotal: 37000, total_details: { amount_discount: 37000 } })).toBe(true);
  expect(skipCheckoutPurchase({ amount_total: 50, amount_subtotal: 37000, discounts: [{ coupon: { percent_off: 100 } }] })).toBe(true);
  expect(skipCheckoutPurchase({ amount_total: 4400, amount_subtotal: 4400, total_details: { amount_discount: 0 } })).toBe(false);
  const capi = readFileSync("supabase/functions/meta-capi/index.ts", "utf8");
  expect(capi.indexOf("zero or 100% off")).toBeLessThan(capi.indexOf("rawValue > 0"));
  expect(readFileSync("supabase/functions/stripe-subscription-webhook/index.ts", "utf8")).toContain("skipCheckoutPurchase");
  expect(readFileSync("supabase/functions/notify-stripe-purchase/index.ts", "utf8")).toContain("skipCheckoutPurchase");
  expect(readFileSync("src/utils/metaCapi.ts", "utf8")).toContain('eventName === "Purchase" && typeof opts.value === "number" && opts.value <= 0');
});

test("the kit grants Basic on Starter accounts and shows customer Stripe names", () => {
  expect(kitBasicGrant("STARTER")).toEqual({ plan: "BASIC", max_onboarding_users: 5 });
  expect(kitBasicGrant(null)).toEqual({ plan: "BASIC", max_onboarding_users: 5 });
  expect(kitBasicGrant("ADVANCED")).toBeNull();
  expect(kitBasicGrant("BASIC")).toBeNull();
  const started = kitBasicAccessUpdate({ plan: "STARTER", trial_source: null, trial_start_date: null, trial_length: null }, Date.parse("2026-10-20T18:03:13.000Z"));
  expect(started).toMatchObject({ plan: "BASIC", max_onboarding_users: 5, trial_source: KIT_BASIC_TRIAL_SOURCE, trial_length: KIT_BASIC_TRIAL_DAYS, trial_start_date: "2026-10-20T18:03:13.000Z" });
  expect(kitBasicAccessUpdate(
    { plan: "STARTER", trial_source: null, trial_start_date: null, trial_length: null },
    Date.parse("2026-10-21T00:00:00.000Z"),
    "2026-10-20T18:03:13.000Z",
  )?.trial_start_date).toBe("2026-10-20T18:03:13.000Z");
  expect(kitBasicAccessUpdate({ plan: "ADVANCED", trial_source: null, trial_start_date: null, trial_length: null })).toBeNull();
  expect(kitBasicTrialEnded({ plan: "BASIC", trial_source: KIT_BASIC_TRIAL_SOURCE, trial_start_date: "2026-10-20T18:03:13.000Z", trial_length: 30 }, Date.parse("2026-11-19T18:03:13.000Z"))).toBe(true);
  expect(kitBasicTrialEnded({ plan: "BASIC", trial_source: KIT_BASIC_TRIAL_SOURCE, trial_start_date: "2026-10-20T18:03:13.000Z", trial_length: 30 }, Date.parse("2026-11-19T18:03:12.000Z"))).toBe(false);
  expect(kitBasicTrialEnded({ plan: "ADVANCED", trial_source: KIT_BASIC_TRIAL_SOURCE, trial_start_date: "2026-10-01T00:00:00.000Z", trial_length: 30 })).toBe(false);
  const grace = readFileSync("supabase/functions/expire-payment-grace/index.ts", "utf8");
  expect(grace).toContain("expireKitBasicTrials");
  expect(grace).toContain("buyerHasPaidSubscription");
  expect(grace).toContain('plan: "STARTER"');
  expect(grace).not.toContain("mark_payment_delinquent', {\n        user_email: em, p_reason: 'kit");
  const shared = readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8");
  expect(shared).toContain("grantKitBasicAccess");
  expect(shared).toContain('import Stripe from "https://esm.sh/stripe@18.5.0";');
  expect(shared).not.toContain("target=deno");
  expect(shared).not.toContain("std@0.177.1");
  expect(shared).toContain("products.update");
  expect(shared).toContain("kit slack notify failed");
  expect(shared).toContain("kit slack posted");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  expect(payment).toContain("KIT_CUSTOMER_COPY[input.offerId].name");
  expect(readFileSync("supabase/functions/slack-notify/index.ts", "utf8")).toContain("slack-notify posted");
  expect(readFileSync("supabase/functions/slack-notify/index.ts", "utf8")).toContain("one_feature_kit_purchase");
  for (const [id, copy] of Object.entries(KIT_CUSTOMER_COPY)) {
    expect(copy.name).not.toMatch(/funnel:/);
    expect(copy.name).not.toBe(id);
    expect(copy.description.length).toBeGreaterThan(10);
  }
  expect(KIT_CUSTOMER_COPY["bump-replay"].name).toBe("Full 90-Minute Training Replay");
  const html = readFileSync("index.html", "utf8");
  expect(html.match(/connect\.facebook\.net\/en_US\/fbevents\.js/g)).toHaveLength(1);
  expect(html).not.toContain("b.write('<script async src=");
  expect(html).not.toContain("__ssPreloadFbq");
  expect(html).toContain("button.ofk-facade img");
  expect(html).toContain("setTimeout(runPixel, 150)");
  expect(html).toContain("setTimeout(runPixel, 2000)");
  expect(readFileSync("src/components/media/YouTubeFacade.tsx", "utf8")).toContain('decoding={eager ? "auto" : "async"}');
  expect(html.match(/fbq\('track', 'PageView'\)/g)).toHaveLength(1);
  expect(html).toContain("fbq('init', '745177780828109')");
  expect(html).toContain("fbq('init', '1601372838188959')");
  const basic = KIT_DELIVERABLES.find(item => item.id === "basic-30");
  expect(basic?.detail).toContain("Starter");
  expect(basic?.detail).not.toContain("keeps the plan already on the account");
});
