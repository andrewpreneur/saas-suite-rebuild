import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import {
  ONBOARDING_NOTIFY_MAX_AGE_MS,
  buildKitOnboardingNotice,
  deliverKitOnboardingWebhook,
  enrichOnboardingOrder,
  KIT_ONBOARDING_WEBHOOK_FALLBACK,
  kitOnboardingWebhookUrl,
  onboardingNotifyAccess,
  onboardingNotifyActionKey,
  onboardingNotifyPlan,
  priorOnboardingOutcomes,
  runClaimedOnboardingNotify,
  type KitPurchaseForOnboarding,
  type OnboardingRow,
} from "../supabase/functions/_shared/kit-onboarding-notify";
import {
  KIT_ONBOARDING_NOTIFY_WAIT_MS,
  settleKitOnboardingNotify,
} from "../src/funnel/one-feature-kit/onboardingNotify";

const ROW_ID = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-10-22T18:10:00.000Z");

const ANSWERS = {
  "First name": "Ada Lovelace",
  "Email you bought with": "Ada@Example.com",
  "Phone (for setup questions)": "+13375550100",
  "Do you have a GoHighLevel account?": "Not yet. Send me the link",
  "Which describes you best?": "Agency owner adding a one-feature product",
  "Business / brand name for your app": "BuildFast AI",
  "Your website or domain (if you have one)": "buildfast.ai",
  "When do you want to launch?": "Within 30 days",
  "What's your biggest question or worry right now?": "Ads and pricing",
  "Link to your logo (PNG, transparent if possible)": "https://files.example/logo.png",
  "Brand colours": "#9C2BDA, #020817",
  "Your GHL agency / company name": "BuildFast Agency",
  "Custom domain or subdomain for your app": "app.buildfast.ai",
  "Where is your domain registered?": "Cloudflare",
  "I've added SaaSSuite as a team member": "yes",
  "Anything else we should know?": "Avoid script fonts",
  "I agree to receive onboarding emails and SMS from SaaSSuite": "yes",
  "Favorite color": "purple",
};

function row(overrides: Partial<OnboardingRow> = {}): OnboardingRow {
  return {
    id: ROW_ID,
    created_at: "2026-10-22T18:04:00.000Z",
    checkout_id: null,
    first_name: "Ada Lovelace",
    email: "Ada@Example.com",
    phone: "+13375550100",
    order_lines: [],
    answers: ANSWERS,
    source: "one-feature-kit",
    ...overrides,
  };
}

function purchases(): KitPurchaseForOnboarding[] {
  return [
    {
      email: "ADA@example.com",
      checkout_session_id: "cs_live_later_addon",
      line_id: "launch",
      amount_cents: 14700,
      created_at: "2026-10-22T17:30:00.000Z",
    },
    {
      email: "ada@example.com",
      checkout_session_id: "cs_live_example",
      line_id: "kit",
      amount_cents: 0,
      created_at: "2026-10-22T17:00:00.000Z",
    },
    {
      email: "ada@example.com",
      checkout_session_id: "cs_live_example",
      line_id: "bump-replay",
      amount_cents: 1700,
      created_at: "2026-10-22T17:00:01.000Z",
    },
    {
      email: "other@example.com",
      checkout_session_id: "cs_live_other",
      line_id: "kit",
      amount_cents: 2700,
      created_at: "2026-10-22T17:40:00.000Z",
    },
  ];
}

test("blank checkout and lines are filled from that email's kit purchases", () => {
  const enriched = enrichOnboardingOrder(row(), purchases());
  expect(enriched.patch).toEqual({
    checkout_id: "cs_live_example",
    order_lines: [
      { id: "kit", label: "The GoHighLevel One Feature Kit", amountCents: 0, kind: "one_time" },
      { id: "bump-replay", label: "Full 90-Minute Training Replay", amountCents: 1700, kind: "one_time" },
      { id: "launch", label: "25 white-labeled ad templates", amountCents: 14700, kind: "one_time" },
    ],
  });
  expect(enriched.checkoutId).toBe("cs_live_example");
  expect(enriched.lines.map((line) => line.id)).toEqual(["kit", "bump-replay", "launch"]);
});

test("a saved checkout id and a non-empty line list are not replaced", () => {
  const savedLines = [{ id: "kit", label: "The GoHighLevel One Feature Kit", amountCents: 2700, kind: "one_time" as const }];
  const kept = enrichOnboardingOrder(
    row({ checkout_id: "cs_live_browser", order_lines: savedLines }),
    purchases(),
  );
  expect(kept.patch).toEqual({});
  expect(kept.checkoutId).toBe("cs_live_browser");
  expect(kept.lines).toEqual(savedLines);

  const linesOnly = enrichOnboardingOrder(row({ checkout_id: "cs_live_browser", order_lines: [] }), purchases());
  expect(linesOnly.patch.checkout_id).toBeUndefined();
  expect(linesOnly.checkoutId).toBe("cs_live_browser");
  expect(linesOnly.patch.order_lines?.map((line) => line.id)).toEqual(["kit", "bump-replay", "launch"]);

  const checkoutOnly = enrichOnboardingOrder(row({ checkout_id: null, order_lines: savedLines }), purchases());
  expect(checkoutOnly.patch).toEqual({ checkout_id: "cs_live_example" });
  expect(checkoutOnly.lines).toEqual(savedLines);

  expect(enrichOnboardingOrder(row(), []).patch).toEqual({});
  expect(enrichOnboardingOrder(row({ checkout_id: "  ", order_lines: {} }), purchases()).patch.checkout_id).toBe("cs_live_example");
});

test("the latest kit checkout wins over a newer add-on session", () => {
  const enriched = enrichOnboardingOrder(row(), [
    { email: "ada@example.com", checkout_session_id: "cs_live_old", line_id: "kit", amount_cents: 2700, created_at: "2026-10-01T00:00:00.000Z" },
    { email: "ada@example.com", checkout_session_id: "cs_live_new", line_id: "kit", amount_cents: 2700, created_at: "2026-10-22T17:00:00.000Z" },
    { email: "ada@example.com", checkout_session_id: "cs_live_upsell", line_id: "launch", amount_cents: 14700, created_at: "2026-10-22T18:00:00.000Z" },
  ]);
  expect(enriched.patch.checkout_id).toBe("cs_live_new");
});

test("the slack message and flat webhook include every form field and the order", () => {
  const notice = buildKitOnboardingNotice(row(), purchases());
  expect(notice.patch.checkout_id).toBe("cs_live_example");
  expect(notice.message.fallback).toBe("One Feature Kit onboarding: Ada Lovelace · BuildFast AI");
  expect(notice.message.text).toBe([
    "*Ada Lovelace* (ada@example.com)",
    "*Phone:* +13375550100",
    "*Business:* BuildFast AI",
    "*Launch:* Within 30 days",
    "*GoHighLevel:* Not yet. Send me the link",
    "*Total:* $164.00",
    "*Items:* The GoHighLevel One Feature Kit, Full 90-Minute Training Replay, 25 white-labeled ad templates",
    "*Checkout:* cs_live_example",
    "*Admin:* https://saassuite.ai/admin/kit-customers?customer=ada%40example.com",
  ].join("\n"));
  expect(notice.message.blocks[0]).toEqual({
    type: "header",
    text: { type: "plain_text", text: "One Feature Kit onboarding" },
  });
  expect(notice.webhook).toEqual({
    event: "saassuite.kit_onboarding",
    onboarding_id: ROW_ID,
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    phone: "+13375550100",
    full_name: "Ada Lovelace",
    business_name: "BuildFast AI",
    launch_timing: "Within 30 days",
    ghl_status: "Not yet. Send me the link",
    buyer_type: "Agency owner adding a one-feature product",
    website: "buildfast.ai",
    biggest_question: "Ads and pricing",
    logo_url: "https://files.example/logo.png",
    brand_colours: "#9C2BDA, #020817",
    ghl_agency_name: "BuildFast Agency",
    custom_domain: "app.buildfast.ai",
    domain_registrar: "Cloudflare",
    team_member_confirmed: "yes",
    setup_notes: "Avoid script fonts",
    marketing_consent: "yes",
    checkout_id: "cs_live_example",
    order_total: "$164.00",
    order_total_cents: 16400,
    order_line_ids: "kit,bump-replay,launch",
    order_lines: "The GoHighLevel One Feature Kit ($0.00); Full 90-Minute Training Replay ($17.00); 25 white-labeled ad templates ($147.00)",
    admin_url: "https://saassuite.ai/admin/kit-customers?customer=ada%40example.com",
    source: "one-feature-kit",
    created_at: "2026-10-22T18:04:00.000Z",
    favorite_color: "purple",
  });
  for (const value of Object.values(notice.webhook)) {
    expect(value === null || typeof value === "string" || typeof value === "number").toBe(true);
  }

  const single = buildKitOnboardingNotice(row({ first_name: "Ada", phone: "", answers: { "Phone (for setup questions)": "+1 337" } }), []);
  expect(single.webhook.first_name).toBe("Ada");
  expect(single.webhook.last_name).toBe("");
  expect(single.webhook.phone).toBe("+1 337");
});

test("an unset GoHighLevel webhook uses the onboarding workflow, and a blank or failed post does not throw", async () => {
  expect(kitOnboardingWebhookUrl(undefined)).toBe(KIT_ONBOARDING_WEBHOOK_FALLBACK);
  expect(KIT_ONBOARDING_WEBHOOK_FALLBACK).toBe(
    "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f49219c1-8d37-4f92-a4d0-079761a743df",
  );
  expect(kitOnboardingWebhookUrl("")).toBeNull();
  expect(kitOnboardingWebhookUrl("  ")).toBeNull();
  expect(kitOnboardingWebhookUrl(" https://hooks.example/onboarding ")).toBe("https://hooks.example/onboarding");
  let postedUrl = "";
  expect(await deliverKitOnboardingWebhook(kitOnboardingWebhookUrl(undefined), "{}", async (url) => {
    postedUrl = url;
    return { ok: true };
  })).toBe("sent");
  expect(postedUrl).toBe(KIT_ONBOARDING_WEBHOOK_FALLBACK);
  expect(await deliverKitOnboardingWebhook(kitOnboardingWebhookUrl(""), "{}", async () => {
    throw new Error("should not post");
  })).toBe("skipped");
  expect(await deliverKitOnboardingWebhook("https://hooks.example/onboarding", "{}", async () => ({ ok: true }))).toBe("sent");
  expect(await deliverKitOnboardingWebhook("https://hooks.example/onboarding", "{}", async () => ({ ok: false, status: 502 }))).toBe("failed");
  expect(await deliverKitOnboardingWebhook("https://hooks.example/onboarding", "{}", async () => {
    throw new Error("down");
  })).toBe("uncertain");

  const started = Date.now();
  let aborted = false;
  const timedOut = await deliverKitOnboardingWebhook("https://hooks.example/onboarding", "{}", (_url, _body, signal) => new Promise((resolve) => {
    signal.addEventListener("abort", () => {
      aborted = true;
      resolve({ ok: false });
    });
  }), 40);
  expect(timedOut).toBe("uncertain");
  expect(aborted).toBe(true);
  expect(Date.now() - started).toBeLessThan(1000);
});

test("notify access matches the caller and only an admin can replay an old row", () => {
  const recent = row();
  const base = {
    rowEmail: recent.email,
    bodyEmail: "ada@example.com",
    createdAt: recent.created_at,
    now: NOW,
    replay: false,
    sessionEmail: null,
    platformAdmin: false,
    internal: false,
  };
  expect(onboardingNotifyAccess(base).ok).toBe(true);
  expect(onboardingNotifyAccess({ ...base, bodyEmail: "other@example.com" })).toMatchObject({ ok: false, status: 404 });
  expect(onboardingNotifyAccess({ ...base, createdAt: new Date(NOW - ONBOARDING_NOTIFY_MAX_AGE_MS).toISOString() }).ok).toBe(true);
  expect(onboardingNotifyAccess({ ...base, createdAt: new Date(NOW - ONBOARDING_NOTIFY_MAX_AGE_MS - 1).toISOString() })).toMatchObject({
    ok: false,
    status: 403,
  });
  expect(onboardingNotifyAccess({ ...base, createdAt: new Date(NOW + 30_000).toISOString() }).ok).toBe(true);
  expect(onboardingNotifyAccess({ ...base, createdAt: new Date(NOW + 3 * 60 * 1000).toISOString() }).ok).toBe(false);
  expect(onboardingNotifyAccess({ ...base, sessionEmail: "ada@example.com" }).ok).toBe(true);
  expect(onboardingNotifyAccess({ ...base, sessionEmail: "owner@agency.com" })).toMatchObject({ ok: false, status: 403 });

  const old = { ...base, createdAt: "2026-10-01T00:00:00.000Z", replay: true };
  expect(onboardingNotifyAccess(old)).toMatchObject({ ok: false, status: 403 });
  expect(onboardingNotifyAccess({ ...old, internal: true }).ok).toBe(true);
  expect(onboardingNotifyAccess({ ...old, platformAdmin: true, sessionEmail: "andrew@dna-media.net" }).ok).toBe(true);
  expect(onboardingNotifyAccess({ ...base, replay: true }).ok).toBe(false);
});

test("one claim key sends each channel once and a later claim does not repeat a success", async () => {
  expect(onboardingNotifyActionKey(ROW_ID)).toBe(`onboarding-notify:${ROW_ID}`);
  expect(priorOnboardingOutcomes([
    { provider: "slack", status: "failed" },
    { provider: "slack", status: "sent" },
    { provider: "gohighlevel", status: "failed" },
    { provider: "other", status: "sent" },
  ])).toEqual({ slack: "sent", ghl: "failed" });

  const calls: string[] = [];
  const plan = onboardingNotifyPlan({ claim: "claimed", prior: {} });
  expect(plan).toEqual({ sendSlack: true, sendGhl: true, finish: false, status: "send" });
  const first = await runClaimedOnboardingNotify({
    plan,
    prior: {},
    sendSlack: async () => {
      calls.push("slack");
      return "sent";
    },
    sendGhl: async () => {
      calls.push("ghl");
      return "failed";
    },
    log: async (channel, result) => {
      calls.push(`log:${channel}:${result}`);
    },
    complete: async () => {
      calls.push("complete");
    },
    release: async () => {
      calls.push("release");
    },
  });
  expect(first).toEqual({ ok: false, slack: "sent", ghl: "failed" });
  expect(calls).toEqual(["slack", "log:slack:sent", "ghl", "log:ghl:failed", "release"]);

  const retryPrior = priorOnboardingOutcomes([
    { provider: "slack", status: "sent" },
    { provider: "gohighlevel", status: "failed" },
  ]);
  const retryPlan = onboardingNotifyPlan({ claim: "claimed", prior: retryPrior });
  expect(retryPlan).toEqual({ sendSlack: false, sendGhl: true, finish: false, status: "send" });
  const retried = await runClaimedOnboardingNotify({
    plan: retryPlan,
    prior: retryPrior,
    sendSlack: async () => {
      calls.push("slack-again");
      return "sent";
    },
    sendGhl: async () => {
      calls.push("ghl-again");
      return "skipped";
    },
    log: async (channel, result) => {
      calls.push(`log:${channel}:${result}`);
    },
    complete: async () => {
      calls.push("complete");
    },
    release: async () => {
      calls.push("release");
    },
  });
  expect(retried).toEqual({ ok: true, slack: "sent", ghl: "skipped" });
  expect(calls).toEqual([
    "slack",
    "log:slack:sent",
    "ghl",
    "log:ghl:failed",
    "release",
    "ghl-again",
    "log:ghl:skipped",
    "complete",
  ]);

  const donePrior = { slack: "sent" as const, ghl: "skipped" as const };
  expect(onboardingNotifyPlan({ claim: "duplicate", prior: donePrior }).status).toBe("duplicate");
  expect(onboardingNotifyPlan({ claim: "busy", prior: {} }).status).toBe("busy");
  expect(onboardingNotifyPlan({ claim: "claimed", prior: donePrior })).toEqual({
    sendSlack: false,
    sendGhl: false,
    finish: true,
    status: "complete",
  });

  const duplicate = await runClaimedOnboardingNotify({
    plan: onboardingNotifyPlan({ claim: "duplicate", prior: donePrior }),
    prior: donePrior,
    sendSlack: async () => {
      throw new Error("should not send");
    },
    sendGhl: async () => {
      throw new Error("should not send");
    },
    log: async () => {
      throw new Error("should not log");
    },
    complete: async () => {
      throw new Error("should not complete");
    },
    release: async () => {
      throw new Error("should not release");
    },
  });
  expect(duplicate).toEqual({ ok: true, slack: "skipped", ghl: "skipped", duplicate: true });

  let released = false;
  const completionFailed = await runClaimedOnboardingNotify({
    plan: onboardingNotifyPlan({ claim: "claimed", prior: donePrior }),
    prior: donePrior,
    sendSlack: async () => "sent",
    sendGhl: async () => "sent",
    log: async () => undefined,
    complete: async () => {
      throw new Error("completion failed");
    },
    release: async () => {
      released = true;
    },
  });
  expect(completionFailed.ok).toBe(false);
  expect(released).toBe(true);
});

test("the thank-you page notifies after the insert and does not block the redirect", async () => {
  expect(KIT_ONBOARDING_NOTIFY_WAIT_MS).toBe(1500);
  const started = Date.now();
  await settleKitOnboardingNotify(new Promise(() => undefined), 40);
  expect(Date.now() - started).toBeLessThan(500);
  await settleKitOnboardingNotify(Promise.reject(new Error("notify down")), 1000);
  const fast = Date.now();
  await settleKitOnboardingNotify(Promise.resolve("ok"), 1000);
  expect(Date.now() - fast).toBeLessThan(200);

  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  const submit = wire.slice(wire.indexOf('"#ofk-onboard-submit"'), wire.indexOf('"#ofk-build-submit"'));
  expect(submit.indexOf(".insert(")).toBeGreaterThan(-1);
  expect(submit.indexOf(".insert(")).toBeLessThan(submit.indexOf("requestKitOnboardingNotify"));
  expect(submit.indexOf("requestKitOnboardingNotify")).toBeLessThan(submit.indexOf("openKitAccount(email)"));
  expect(submit).toContain("crypto.randomUUID()");
  expect(submit).toContain("settleKitOnboardingNotify");
  expect(submit).toContain("id: rowId");

  const client = readFileSync("src/funnel/one-feature-kit/onboardingNotify.ts", "utf8");
  const fn = readFileSync("supabase/functions/kit-onboarding-notify/index.ts", "utf8");
  const shared = readFileSync("supabase/functions/_shared/kit-onboarding-notify.ts", "utf8");
  const payment = readFileSync("supabase/functions/_shared/kit-payment.ts", "utf8");
  const slack = readFileSync("supabase/functions/slack-notify/index.ts", "utf8");
  const script = readFileSync("scripts/notify-kit-onboarding.ts", "utf8");
  expect(client).toContain("kit-onboarding-notify");
  expect(client).not.toMatch(/resend/i);
  expect(fn).toContain('forwardKitSlack("one_feature_kit_onboarding"');
  expect(fn).toContain('Deno.env.get("GHL_KIT_ONBOARDING_WEBHOOK_URL")');
  expect(fn).toContain('claim_one_feature_kit_action');
  expect(fn).toContain("onboardingNotifyActionKey");
  expect(fn).not.toMatch(/resend/i);
  expect(shared).toContain("KIT_ONBOARDING_WEBHOOK_FALLBACK");
  expect(shared).toContain("f49219c1-8d37-4f92-a4d0-079761a743df");
  expect(shared).not.toMatch(/resend/i);
  expect(payment).toContain("export async function forwardKitSlack");
  expect(payment).toContain('forwardKitSlack("one_feature_kit_purchase"');
  expect(payment).toContain("export async function requestKitNotify");
  expect(slack).toContain("one_feature_kit_onboarding");
  expect(slack).toContain("kitOnboardingSlackMessage");
  expect(script).toContain("replay: true");
  expect(script).toContain("ghl_webhook_url");
  expect(script).toContain("KIT_ONBOARDING_WEBHOOK_FALLBACK");
  expect(script).toContain("kitOnboardingWebhookUrl");
  expect(script.indexOf("dry_run: true")).toBeLessThan(script.indexOf("await fetch"));
  expect(readFileSync("supabase/config.toml", "utf8")).toContain("[functions.kit-onboarding-notify]");
});
