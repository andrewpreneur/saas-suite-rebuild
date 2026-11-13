import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { KIT_PLAN_CHANGE_TAG, kitPlanChangeIsKitGrant } from "../supabase/functions/_shared/kit-basic";
import { kitCheckoutMetaPurchase, kitMetaActionKey, kitPurchaseEventId, runMetaPurchaseDelivery } from "../supabase/functions/_shared/kit-meta";
import {
  completeKitLoginAfterGhl,
  deliverKitBuyerLogin,
  fulfillKitCheckout,
  kitBuyerSignInUrl,
  kitLoginActionKey,
  parseStoredKitLogin,
  type KitStoredLogin,
} from "../supabase/functions/_shared/kit-login";
import { STAPE_GA4_MEASUREMENT_ID, buildStapePurchaseRequest, sendKitServerPurchase, sha256Hex, stapeClientId } from "../supabase/functions/_shared/kit-stape";
import { kitGhlDefiniteFailure, kitGhlPostResult, kitGhlReceipt, kitLynkificActionKey, kitPurchasedPayload, kitPurchasedSendLog, runLynkificDelivery } from "../supabase/functions/_shared/kit-lynkific";
import { linkSiteAnalyticsEmail, siteAnalyticsEmailFilter } from "../supabase/functions/_shared/kit-site-link";
import { KIT_BUYER_SOURCE, kitBuyerAttributionPatch } from "../supabase/functions/_shared/saas-user-write";

const NOW = Date.parse("2026-10-22T18:00:00.000Z");
const LINK = "https://auth.example/verify?token=kit";

function loginAdmin(calls: string[]) {
  return {
    generateLink: async (args: { type: string }) => {
      calls.push(args.type);
      if (args.type === "invite") return { data: null, error: { message: "already registered" } };
      return { data: { properties: { action_link: LINK }, user: { id: "user-9" } }, error: null };
    },
  };
}

const metadata = {
  fbp: "fb.1.1",
  fbc: "fb.1.2.click",
  fbclid: "click-new",
  utm_source: "facebook",
  utm_medium: "paid",
  utm_campaign: "kit",
  utm_content: "video",
  utm_term: "ghl",
  landing_page: "https://saassuite.ai/one-feature-kit",
  referrer: "https://facebook.com/",
  page_url: "https://saassuite.ai/one-feature-kit/checkout",
  name: "From Meta",
};

test("kit login does not call Resend and the checkout still fires GoHighLevel and Meta", async () => {
  const minted: string[] = [];
  const released: string[] = [];
  const completed: string[] = [];
  let claimed = false;
  const login = await deliverKitBuyerLogin({
    checkoutId: "cs_live_resend",
    email: "Buyer@Example.com",
    name: "Ada",
    now: NOW,
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    readClaim: async () => ({ completed: false }),
    releaseClaim: async (key) => { released.push(key); },
    completeClaim: async (key) => { completed.push(key); },
    admin: loginAdmin(minted),
    ensureStarter: async () => { throw new Error("starter down"); },
    linkUser: async () => {},
  });
  expect(login).toMatchObject({ ok: true, emailed: false, actionLink: LINK, userId: "user-9" });
  expect(login.signInUrl).toContain("buyer%40example.com");
  expect(completed).toEqual([]);
  expect(released).toEqual([]);
  expect(minted).toEqual(["invite", "magiclink"]);

  const calls: string[] = [];
  let status = 500;
  try {
    const caught = login;
    const done = await fulfillKitCheckout({
      deliverLynkific: async () => { calls.push(`ghl:${caught.signInUrl}|${caught.actionLink}`); },
      notify: async () => { calls.push("notify"); throw new Error("slack down"); },
      emitPurchase: async () => { calls.push("meta"); },
      onNotifyError: () => { calls.push("notify-caught"); },
    });
    expect(done).toEqual({ ok: true });
    status = 200;
  } catch {
    status = 500;
  }
  expect(status).toBe(200);
  expect(calls).toEqual([
    `ghl:${login.signInUrl}|${LINK}`,
    "notify",
    "notify-caught",
    "meta",
  ]);

  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const payment = readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8");
  expect(webhook).toContain("sendKitBuyerLogin(stripe, session.id).catch");
  expect(webhook).toContain("fulfillKitCheckout");
  expect(webhook.indexOf("await sendKitBuyerLogin")).toBeLessThan(webhook.indexOf("await runLynkificDelivery"));
  expect(webhook.indexOf("await runLynkificDelivery")).toBeLessThan(webhook.indexOf("await emitKitPurchase"));
  expect(webhook).toContain('return new Response("ok")');
  expect(webhook).toContain('templateKey: "kit_login"');
  expect(webhook).toContain('provider: "ghl"');
  expect(payment).not.toContain("RESEND_API_KEY");
  expect(payment).not.toContain("api.resend.com");
  expect(readFileSync("supabase/functions/_shared/kit-login.ts", "utf8")).not.toContain("api.resend.com");
});

test("a Stripe retry reuses a valid login link and does not post GoHighLevel or Meta again", async () => {
  const minted: string[] = [];
  let stored: KitStoredLogin | null = null;
  let claimed = false;
  const base = {
    checkoutId: "cs_live_retry",
    email: "buyer@example.com",
    name: "Ada",
    now: NOW,
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    readClaim: async () => ({ completed: false }),
    releaseClaim: async () => { claimed = false; },
    completeClaim: async () => {},
    admin: loginAdmin(minted),
    ensureStarter: async () => {},
    linkUser: async () => {},
    readStoredLogin: async () => stored,
    rememberLogin: async (login: KitStoredLogin) => { stored = login; },
  };
  const first = await deliverKitBuyerLogin(base);
  const second = await deliverKitBuyerLogin({ ...base, now: NOW + 60_000 });
  expect(first.actionLink).toBe(LINK);
  expect(second.actionLink).toBe(LINK);
  expect(minted).toEqual(["invite", "magiclink"]);
  expect(parseStoredKitLogin(JSON.stringify(stored))?.actionLink).toBe(LINK);
  expect(parseStoredKitLogin("pi_live_123")).toBeNull();

  const expired = await deliverKitBuyerLogin({
    ...base,
    checkoutId: "cs_live_expired",
    now: NOW + 3 * 60 * 60 * 1000,
    claim: async () => true,
    readStoredLogin: async () => stored,
  });
  expect(expired.actionLink).toBe(LINK);
  expect(minted).toEqual(["invite", "magiclink", "invite", "magiclink"]);

  const payload = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "",
    name: "Ada",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_retry",
    loginUrl: LINK,
    magicLink: LINK,
    purchasedAt: "2026-10-22T18:00:00.000Z",
  });
  const purchase = kitCheckoutMetaPurchase({
    sessionId: "cs_live_retry",
    amountTotalCents: 2700,
    comped: false,
    trackingOptout: false,
    lines: [{ id: "kit", amountCents: 2700, name: "Kit" }],
  });
  let lynkificDone = false;
  let metaDone = false;
  let posts = 0;
  let metaSends = 0;
  const deliver = () => fulfillKitCheckout({
    deliverLynkific: async () => {
      await runLynkificDelivery({
        claimed: !lynkificDone,
        completed: lynkificDone,
        payload,
        url: "https://hooks.example/kit",
        post: async () => { posts += 1; return { ok: true }; },
        release: async () => { throw new Error("should not release"); },
        complete: async () => { lynkificDone = true; },
      });
    },
    notify: async () => {},
    emitPurchase: async () => {
      await runMetaPurchaseDelivery({
        claimed: !metaDone,
        completed: metaDone,
        purchase,
        send: async () => { metaSends += 1; return true; },
        release: async () => { throw new Error("should not release"); },
        complete: async () => { metaDone = true; },
      });
    },
  });
  expect(await deliver()).toEqual({ ok: true });
  expect(await deliver()).toEqual({ ok: true });
  expect(posts).toBe(1);
  expect(metaSends).toBe(1);
});

test("Stripe retry after manual send", async () => {
  const session = "cs_live_manual";
  expect(kitLynkificActionKey(session)).toBe(`lynkific:${session}`);
  expect(kitMetaActionKey(session)).toBe(`meta:${session}`);
  expect(kitPurchaseEventId(session)).toBe(`order_${session}`);
  const payload = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "",
    name: "Ada",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: session,
    loginUrl: LINK,
    magicLink: LINK,
    purchasedAt: "2026-10-22T18:00:00.000Z",
  });
  const purchase = kitCheckoutMetaPurchase({
    sessionId: session,
    amountTotalCents: 2700,
    comped: false,
    trackingOptout: false,
    lines: [{ id: "kit", amountCents: 2700, name: "Kit" }],
  });
  let posts = 0;
  let metaSends = 0;
  const ghl = await runLynkificDelivery({
    claimed: false,
    completed: true,
    payload,
    url: "https://hooks.example/kit",
    post: async () => { posts += 1; return { ok: true, status: 200, id: "should-not-post" }; },
    release: async () => { throw new Error("should not release"); },
    complete: async () => { throw new Error("should not complete"); },
  });
  const tracked = await runMetaPurchaseDelivery({
    claimed: false,
    completed: true,
    purchase,
    send: async () => { metaSends += 1; return true; },
    release: async () => { throw new Error("should not release"); },
    complete: async () => { throw new Error("should not complete"); },
  });
  expect(ghl).toBe("duplicate");
  expect(tracked).toBe("duplicate");
  expect(posts).toBe(0);
  expect(metaSends).toBe(0);
  expect(purchase?.eventId).toBe(`order_${session}`);
});

test("retry after a failed GHL send", async () => {
  const payload = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "",
    name: "Ada",
    lineIds: ["kit", "bump-replay"],
    amountCentsTotal: 4400,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_ghl_retry",
    loginUrl: LINK,
    magicLink: LINK,
    purchasedAt: "2026-10-22T18:00:00.000Z",
  });
  let completed = false;
  let leased = false;
  let posts = 0;
  const receipt = kitGhlReceipt();
  const claim = () => {
    if (completed || leased) return false;
    leased = true;
    return true;
  };
  const run = (ok: boolean) => runLynkificDelivery({
    claimed: claim(),
    completed,
    payload,
    url: "https://hooks.example/kit",
    receipt,
    post: async () => {
      posts += 1;
      return ok
        ? { ok: true, status: 200, id: "ghl_msg_1" }
        : { ok: false, status: 502, id: null };
    },
    release: async () => { leased = false; },
    complete: async () => { completed = true; leased = false; },
  });
  expect(await run(false)).toBe("failed");
  expect(posts).toBe(1);
  expect(receipt).toEqual({ httpStatus: 502, responseId: null });
  expect(await run(true)).toBe("sent");
  expect(posts).toBe(2);
  expect(receipt).toEqual({ httpStatus: 200, responseId: "ghl_msg_1" });
  expect(await run(true)).toBe("duplicate");
  expect(posts).toBe(2);
  const logged = kitPurchasedSendLog({
    email: "Buyer@Example.com",
    checkoutSessionId: "cs_live_ghl_retry",
    source: "webhook",
    outcome: "sent",
    httpStatus: receipt.httpStatus,
    responseId: receipt.responseId,
  });
  expect(logged).toMatchObject({
    userEmail: "buyer@example.com",
    templateKey: "kit_purchased",
    provider: "ghl",
    providerMessageId: "ghl_msg_1",
    status: "sent",
    source: "webhook",
    detail: "http_200",
    metadata: {
      event: "saassuite.kit_purchased",
      checkout_session_id: "cs_live_ghl_retry",
      ghl_status: 200,
      ghl_id: "ghl_msg_1",
    },
  });
  expect(logged.metadata.event).toBe("saassuite.kit_purchased");
  expect(kitGhlPostResult(200, JSON.stringify({ id: "wh_9", status: "Success" }))).toEqual({
    ok: true,
    status: 200,
    id: "wh_9",
  });
  expect(kitPurchasedSendLog({
    email: "buyer@example.com",
    checkoutSessionId: "cs_live_ghl_retry",
    source: "manual_refire",
    outcome: "failed",
    httpStatus: 502,
    responseId: null,
  }).source).toBe("manual_refire");

  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const refire = readFileSync("supabase/functions/one-feature-kit-refire/index.ts", "utf8");
  const script = readFileSync("scripts/refire-kit-purchased.ts", "utf8");
  expect(webhook).toContain('source: "webhook"');
  expect(webhook).toContain("logKitPurchasedSend");
  expect(webhook).toContain("kitGhlPostResult");
  expect(refire).toContain('source: "manual_refire"');
  expect(refire).toContain("kitPurchasedPayload");
  expect(refire).toContain("kitLynkificActionKey");
  expect(script).toContain("kitPurchasedPayload");
  expect(script).toContain("kitLynkificActionKey");
  expect(script).toContain("kitPurchasedSendLog");
  expect(script).toContain('source: "manual_refire"');
  expect(script.indexOf("if (!send)")).toBeLessThan(script.indexOf("await fetch"));
  expect(script).toContain("--send");
  expect(script).toContain("dry_run: true");
  expect(payload.items_summary).toContain("<br>");
  expect(payload.items_summary).not.toContain("\n");
});

test("a GoHighLevel timeout keeps the lease and a definite 5xx can be posted again", async () => {
  const payload = kitPurchasedPayload({
    email: "buyer@example.com",
    phone: "",
    name: "Ada",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_lease",
    loginUrl: "https://saassuite.ai/signup?email=buyer%40example.com",
    magicLink: "https://saassuite.ai/signup?email=buyer%40example.com",
    purchasedAt: "2026-10-22T18:00:00.000Z",
  });
  const LEASE_MS = 5 * 60 * 1000;
  let posts = 0;
  let leased = false;
  let completed = false;
  let leaseUntil = 0;
  const clock = { t: 1_000_000 };
  const claim = () => {
    if (completed) return false;
    if (leased && leaseUntil > clock.t) return false;
    leased = true;
    leaseUntil = clock.t + LEASE_MS;
    return true;
  };
  const deliver = (post: (url: string, body: string, signal: AbortSignal) => Promise<{ ok: boolean; status?: number | null }>) =>
    runLynkificDelivery({
      claimed: claim(),
      completed,
      payload,
      url: "https://hooks.example/kit",
      timeoutMs: 30,
      post,
      release: async () => { leased = false; leaseUntil = 0; },
      complete: async () => { completed = true; leased = false; },
    });

  const hung = await deliver((_url, _body, signal) => {
    posts += 1;
    return new Promise(() => {
      signal.addEventListener("abort", () => {});
    });
  });
  expect(hung).toBe("failed");
  expect(posts).toBe(1);
  expect(leased).toBe(true);
  expect(completed).toBe(false);
  clock.t += 1_000;
  const insideLease = await deliver(async () => {
    posts += 1;
    return { ok: true, status: 200 };
  });
  expect(insideLease).toBe("overlap");
  expect(posts).toBe(1);
  clock.t += LEASE_MS;
  const afterLease = await deliver(async () => {
    posts += 1;
    return { ok: false, status: 502, id: null };
  });
  expect(afterLease).toBe("failed");
  expect(posts).toBe(2);
  expect(leased).toBe(false);

  let rejectedPosts = 0;
  let rejectedLease = false;
  let rejectedDone = false;
  const claimRejected = () => {
    if (rejectedDone || rejectedLease) return false;
    rejectedLease = true;
    return true;
  };
  const rejectedDeliver = (status: number) => runLynkificDelivery({
    claimed: claimRejected(),
    completed: rejectedDone,
    payload,
    url: "https://hooks.example/kit",
    post: async () => {
      rejectedPosts += 1;
      return status >= 200 && status < 300
        ? { ok: true, status, id: "ghl_ok" }
        : { ok: false, status, id: null };
    },
    release: async () => { rejectedLease = false; },
    complete: async () => { rejectedDone = true; rejectedLease = false; },
  });
  const rejected = await rejectedDeliver(502);
  expect(rejected).toBe("failed");
  expect(rejectedPosts).toBe(1);
  expect(rejectedLease).toBe(false);
  const again = await rejectedDeliver(200);
  expect(again).toBe("sent");
  expect(rejectedPosts).toBe(2);
  expect(kitGhlDefiniteFailure({ ok: false, status: 502 })).toBe(true);
  expect(kitGhlDefiniteFailure({ ok: false })).toBe(false);
  expect(kitGhlDefiniteFailure({ ok: false, status: 0 })).toBe(false);

  const loginRows: string[] = [];
  expect(await completeKitLoginAfterGhl({
    checkoutId: "cs_live_lease",
    outcome: hung,
    markCompleted: async (key) => { loginRows.push(key); },
  })).toBe(false);
  expect(await completeKitLoginAfterGhl({
    checkoutId: "cs_live_lease",
    outcome: rejected,
    markCompleted: async (key) => { loginRows.push(key); },
  })).toBe(false);
  expect(loginRows).toEqual([]);
  expect(await completeKitLoginAfterGhl({
    checkoutId: "cs_live_lease",
    outcome: again,
    markCompleted: async (key) => { loginRows.push(key); },
  })).toBe(true);
  expect(loginRows).toEqual([kitLoginActionKey("cs_live_lease")]);

  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const refire = readFileSync("supabase/functions/one-feature-kit-refire/index.ts", "utf8");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const verifyStart = payment.indexOf('if (input.action === "verify")');
  const verifyEnd = payment.indexOf("const lineIds = mergeOwnedKitLineIds", verifyStart);
  const verify = payment.slice(verifyStart, verifyEnd);
  expect(webhook.indexOf("await runLynkificDelivery")).toBeLessThan(webhook.indexOf("await markKitLoginCompleted"));
  expect(refire.indexOf("await runLynkificDelivery")).toBeLessThan(refire.indexOf("await markKitLoginCompleted"));
  expect(verify).not.toContain("sendKitBuyerLogin");
  expect(verify).not.toContain("api.resend.com");
  expect(verify).not.toContain("generateLink");
  expect(verify).toContain("prepareKitBuyer");
  expect(payment).not.toContain("RESEND");
});

test("kit attribution fills only null columns and leaves plan, approval, and access alone", () => {
  const now = "2026-10-22T18:00:00.000Z";
  const patch = kitBuyerAttributionPatch({
    existing: {
      full_name: "Philip",
      fbclid: "kept-click",
      fbc: null,
      fbp: "kept-fbp",
      utm_source: "newsletter",
      utm_medium: null,
      landing_page: "https://saassuite.ai/pricing",
      referrer: null,
      checkout_page: "/special",
      source: "signup",
      last_utm_source: "google",
      last_utm_medium: null,
      last_touch_at: "2026-10-01T00:00:00.000Z",
      agency_id: null,
    },
    metadata,
    name: "Ada Lovelace",
    nowIso: now,
    createdHere: false,
  });
  expect(patch.utm_source).toBeUndefined();
  expect(patch.utm_medium).toBe("paid");
  expect(patch.fbclid).toBeUndefined();
  expect(patch.fbc).toBe("fb.1.2.click");
  expect(patch.fbp).toBeUndefined();
  expect(patch.landing_page).toBeUndefined();
  expect(patch.referrer).toBe("https://facebook.com/");
  expect(patch.checkout_page).toBeUndefined();
  expect(patch.full_name).toBeUndefined();
  expect(patch.source).toBeUndefined();
  expect(patch.last_utm_source).toBeUndefined();
  expect(patch.last_utm_medium).toBe("paid");
  expect(patch.last_touch_at).toBeUndefined();
  expect(patch.plan).toBeUndefined();
  expect(patch.approval).toBeUndefined();
  expect(patch.max_onboarding_users).toBeUndefined();
  expect(patch.agency_id).toBeUndefined();
  expect(patch.agency_id_basic).toBeUndefined();
  expect(patch.trial_source).toBeUndefined();

  const fresh = kitBuyerAttributionPatch({
    existing: { source: "signup", full_name: null, checkout_page: null },
    metadata,
    name: "",
    nowIso: now,
    createdHere: true,
  });
  expect(fresh.source).toBe(KIT_BUYER_SOURCE);
  expect(fresh.full_name).toBe("From Meta");
  expect(fresh.checkout_page).toBe("https://saassuite.ai/one-feature-kit/checkout");
  expect(fresh.utm_source).toBe("facebook");
  expect(fresh.last_utm_source).toBe("facebook");
  expect(fresh.last_touch_at).toBe(now);
  expect(fresh.plan).toBeUndefined();
  expect(fresh.approval).toBeUndefined();

  const named = kitBuyerAttributionPatch({
    existing: { full_name: null, source: "webinar" },
    metadata: { name: "Meta Name", page_url: "https://saassuite.ai/one-feature-kit/checkout" },
    name: "Stripe Name",
    nowIso: now,
  });
  expect(named.full_name).toBe("Stripe Name");
  expect(named.source).toBeUndefined();
  expect(named.checkout_page).toBe("https://saassuite.ai/one-feature-kit/checkout");

  const emptyName = kitBuyerAttributionPatch({
    existing: {},
    metadata: { name: "Meta Name" },
    name: "  ",
    nowIso: now,
  });
  expect(emptyName.full_name).toBe("Meta Name");
  expect(emptyName.source).toBe(KIT_BUYER_SOURCE);
  expect(emptyName.last_touch_at).toBeUndefined();

  expect(kitPlanChangeIsKitGrant({ old_plan: "STARTER", new_plan: "BASIC", source: "database" })).toBe(true);
  expect(kitPlanChangeIsKitGrant({ old_plan: null, new_plan: "BASIC", source: "database" })).toBe(true);
  expect(kitPlanChangeIsKitGrant({ old_plan: "ADVANCED", new_plan: "BASIC", source: "database" })).toBe(false);
  expect(kitPlanChangeIsKitGrant({ old_plan: "STARTER", new_plan: "BASIC", source: "one_feature_kit" })).toBe(false);
  expect(KIT_PLAN_CHANGE_TAG).toEqual({ source: "one_feature_kit", actor: "one-feature-kit" });
  expect(readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8")).toContain("tagKitBasicPlanChange");
  expect(readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8")).toContain("kitBuyerAttributionPatch");
});

test("browsing is linked by site session id and not by visitor key", async () => {
  expect(siteAnalyticsEmailFilter("short", "buyer@example.com")).toBeNull();
  expect(siteAnalyticsEmailFilter("m1abcde-x7k2p9q", "not-an-email")).toBeNull();
  const calls: string[] = [];
  const result = await linkSiteAnalyticsEmail({
    from(table) {
      calls.push(table);
      return {
        update(row) {
          calls.push(`update:${row.user_email}`);
          return {
            eq(column, value) {
              calls.push(`eq:${column}:${value}`);
              return {
                is: async (columnName, valueNull) => {
                  calls.push(`is:${columnName}:${String(valueNull)}`);
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  }, "m1abcde-x7k2p9q", "Buyer@Example.com");
  expect(result).toBe("linked");
  expect(calls).toEqual([
    "site_analytics_events",
    "update:buyer@example.com",
    "eq:session_id:m1abcde-x7k2p9q",
    "is:user_email:null",
  ]);
  expect(calls.join(" ")).not.toContain("visitor_key");
  const webhook = readFileSync("supabase/functions/one-feature-kit-webhook/index.ts", "utf8");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const client = readFileSync("src/funnel/one-feature-kit/payment.ts", "utf8");
  const page = readFileSync("src/pages/OneFeatureKit.tsx", "utf8");
  expect(webhook).toContain("linkSiteAnalyticsEmail");
  expect(webhook).toContain("checkout.metadata?.site_session_id");
  expect(webhook).not.toContain("visitor_key");
  expect(payment).toContain("site_session_id: siteSessionId");
  expect(client).toContain("site_session_id: siteSessionId");
  expect(page).toContain("mod.trackFunnelPageview(path, confirmedBuyerEmail)");
  expect(page).toContain("loadDraft().contact.email");
});

test("a Stape Purchase uses the browser event id and does not also call Meta", async () => {
  const hit = await buildStapePurchaseRequest({
    endpoint: "https://xyaheorc.usw.stape.io/g/collect",
    eventId: "order_cs_live_stape",
    eventTimeSec: 1_700_000_000,
    value: 71,
    currency: "usd",
    orderId: "cs_live_stape",
    email: "Buyer@Example.com",
    phone: "(555) 123-4567",
    fbp: "fb.1.1",
    fbc: "fb.1.2.click",
    fbclid: "click",
  });
  expect(hit.protocol).toBe("ga4-collect");
  expect(hit.body).toBe("");
  const query = new URL(hit.url).searchParams;
  expect(query.get("en")).toBe("purchase");
  expect(query.get("tid")).toBe(STAPE_GA4_MEASUREMENT_ID);
  expect(query.get("cid")).toBe(stapeClientId("cs_live_stape"));
  expect(query.get("ep.event_id")).toBe("order_cs_live_stape");
  expect(query.get("ep.event_name")).toBe("Purchase");
  expect(query.get("epn.value")).toBe("71");
  expect(query.get("ep.currency")).toBe("USD");
  expect(query.get("ep.sha256_email_address")).toBe(await sha256Hex("buyer@example.com"));
  expect(query.get("ep.sha256_phone_number")).toBe(await sha256Hex("15551234567"));
  expect(query.get("ep.x-fb-ck-fbp")).toBe("fb.1.1");
  expect(query.get("ep.x-fb-ck-fbc")).toBe("fb.1.2.click");

  const mp = await buildStapePurchaseRequest({
    endpoint: "https://xyaheorc.usw.stape.io/mp/collect",
    apiSecret: "secret",
    eventId: "order_cs_live_stape",
    eventTimeSec: 1_700_000_000,
    value: 71,
    currency: "USD",
    orderId: "cs_live_stape",
    email: "buyer@example.com",
  });
  expect(mp.protocol).toBe("ga4-mp");
  expect(new URL(mp.url).searchParams.get("measurement_id")).toBe(STAPE_GA4_MEASUREMENT_ID);
  expect(new URL(mp.url).searchParams.get("api_secret")).toBe("secret");
  const mpBody = JSON.parse(mp.body) as { events: { name: string; params: { event_id: string; value: number } }[] };
  expect(mpBody.events[0].name).toBe("purchase");
  expect(mpBody.events[0].params.event_id).toBe("order_cs_live_stape");
  expect(mpBody.events[0].params.value).toBe(71);

  let meta = 0;
  let posted = "";
  const sent = await sendKitServerPurchase({
    stapeUrl: hit.url,
    stapeToken: "tok",
    body: hit.body,
    headers: hit.headers,
    post: async (url, body, headers) => {
      posted = `${url}|${headers.Authorization}|${body}`;
      return { ok: true };
    },
    sendMeta: async () => { meta += 1; return true; },
  });
  expect(sent).toEqual({ via: "stape", ok: true });
  expect(meta).toBe(0);
  expect(posted).toContain("Bearer tok");
  expect(posted).toContain("ep.event_id=order_cs_live_stape");
  const failed = await sendKitServerPurchase({
    stapeUrl: hit.url,
    body: "",
    post: async () => { throw new Error("401"); },
    sendMeta: async () => { meta += 1; return true; },
  });
  expect(failed).toEqual({ via: "stape", ok: false });
  expect(meta).toBe(0);
  const direct = await sendKitServerPurchase({
    stapeUrl: null,
    body: "",
    post: async () => { throw new Error("should not post"); },
    sendMeta: async () => { meta += 1; return true; },
  });
  expect(direct).toEqual({ via: "meta", ok: true });
  expect(meta).toBe(1);
  expect(readFileSync("supabase/functions/one-feature-kit-refire/index.ts", "utf8")).toContain("skip_meta");
  expect(readFileSync("supabase/functions/stripe-subscription-webhook/index.ts", "utf8")).toContain("isOneFeatureKitFunnel");
});
