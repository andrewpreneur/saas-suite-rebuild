import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { memoryGhlEmailClaims, ghlEmailDedupeKey } from "../supabase/functions/_shared/ghl-email-claim";
import { ghlEmailBody, ghlTemplateUrlProblem, postGhlEmailEvent, type GhlEmailFetch } from "../supabase/functions/_shared/ghl-email-webhook";
import { ghlFreeText, ghlGreetingName } from "../supabase/functions/_shared/ghl-email-text";
import { attemptKitCheckoutStarted, kitCheckoutStartedPayload, queueKitCheckoutStarted, type KitCheckoutStartedInput } from "../supabase/functions/_shared/kit-checkout-started";
import { kitTotal } from "../supabase/functions/_shared/kit-catalog";
import { buildKitOnboardingNotice, runClaimedOnboardingNotify, type OnboardingRow } from "../supabase/functions/_shared/kit-onboarding-notify";
import { kitPurchasedPayload, kitPurchasedUrlProblem, runLynkificDelivery } from "../supabase/functions/_shared/kit-lynkific";

const TICKET = "https://saassuite.ai/support";

function ticketEnv(url: string | undefined): (name: string) => string | undefined {
  return (name) => (name === "GHL_TICKET_CONFIRMATION_WEBHOOK_URL" ? url : undefined);
}

test("a missing first name becomes the stored name, then the mailbox, then there", () => {
  expect(ghlGreetingName({ firstName: "  Pat  ", fullName: "Other Person", email: "ada@example.com" })).toMatchObject({
    first_name: "Pat",
  });
  expect(ghlGreetingName({ fullName: "Pat Example", email: "ada@example.com" })).toEqual({
    first_name: "Pat",
    last_name: "Example",
    full_name: "Pat Example",
  });
  expect(ghlGreetingName({ email: "ada.lovelace@example.com" })).toMatchObject({
    first_name: "Ada.lovelace",
    full_name: "Ada.lovelace",
  });
  expect(ghlGreetingName({ email: "  " }).first_name).toBe("there");
  expect(ghlGreetingName({}).first_name).toBe("there");

  expect(ghlEmailBody("ticket_confirmation", { email: "pat@example.com" })).toMatchObject({
    first_name: "Pat",
    full_name: "Pat",
  });
  expect(ghlEmailBody("admin_invite", { email: "sam@agency.com", full_name: "" })).toMatchObject({
    first_name: "Sam",
  });
  expect(ghlEmailBody("support_rep_login", { email: "not-an-email" }).first_name).toBe("there");

  expect(kitPurchasedPayload({
    email: "ada@example.com",
    phone: "",
    name: "",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_name",
    loginUrl: "https://saassuite.ai/signup",
    purchasedAt: "2026-10-23T00:00:00.000Z",
  })).toMatchObject({ first_name: "Ada", full_name: "Ada" });

  const started = queueName("");
  expect(started.first_name).toBe("Ada");
  expect(onboardingName("   ", "ada@example.com").first_name).toBe("Ada");
  expect(onboardingName("<b></b>", "ada@example.com").first_name).toBe("Ada");
});

test("names and free text are stripped, escaped, and capped before a post", () => {
  const messy = `<b>Pat</b> & "O'Brien"\u0007<script>alert(1)</script>`;
  const body = ghlEmailBody("admin_invite", {
    email: "pat@example.com",
    full_name: messy,
    inviter_name: messy,
    agency_name: "A".repeat(120),
    invite_url: "https://auth.example/verify?token=1&next=1",
  });
  expect(body.first_name).toBe("Pat");
  expect(String(body.full_name)).toBe("Pat &amp; &quot;O&#39;Brien&quot; alert(1)");
  expect(String(body.full_name)).not.toContain("<");
  expect(String(body.inviter_name)).not.toContain("<");
  expect(String(body.inviter_name)).toContain("&amp;");
  expect(String(body.agency_name)).toHaveLength(80);
  expect(body.invite_url).toBe("https://auth.example/verify?token=1&next=1");
  expect(ghlFreeText("A".repeat(90))).toHaveLength(80);

  const purchased = kitPurchasedPayload({
    email: "pat@example.com",
    phone: "",
    name: messy,
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_name",
    loginUrl: "https://saassuite.ai/signup",
    magicLink: "https://auth.example/verify?token=1",
    purchasedAt: "2026-10-23T00:00:00.000Z",
  });
  expect(purchased.first_name).toBe("Pat");
  expect(purchased.full_name).not.toContain("<");
  expect(purchased.login_url).toBe("https://saassuite.ai/signup");

  expect(queueName(messy).first_name).toBe("Pat");
  expect(String(queueName(messy).last_name)).not.toContain("<");
  const notice = onboardingName("<b>Pat</b> Example", "pat@example.com");
  expect(notice.first_name).toBe("Pat");
  expect(String(notice.business_name)).not.toContain("<");
  expect(String(notice.business_name)).toContain("&amp;");
});

test("a missing or non-https template URL is not posted and does not complete the claim", async () => {
  const fetches: string[] = [];
  const fetchImpl: GhlEmailFetch = async (url) => {
    fetches.push(url);
    return { ok: true, status: 200 };
  };
  const claims = memoryGhlEmailClaims();
  const logs: Array<Record<string, unknown>> = [];
  const missing = await postGhlEmailEvent("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat Example",
  }, {
    getEnv: ticketEnv("https://hooks.example.test/ticket"),
    fetchImpl,
    claims,
    dedupeKey: "ticket_confirmation:ticket-1",
    log: async (row) => {
      logs.push(row);
    },
  });
  const insecure = await postGhlEmailEvent("admin_invite", {
    email: "sam@agency.com",
    full_name: "Sam",
    invite_url: "http://auth.example/verify",
  }, {
    getEnv: (name) => (name === "GHL_ADMIN_INVITE_WEBHOOK_URL" ? "https://hooks.example.test/admin" : undefined),
    fetchImpl,
    claims,
    dedupeKey: "admin_invite:invite-1",
    log: async (row) => {
      logs.push(row);
    },
  });
  expect(missing).toEqual({ ok: false, status: "failed", detail: "missing_ticket_url" });
  expect(insecure).toEqual({ ok: false, status: "failed", detail: "invalid_invite_url" });
  expect(fetches).toEqual([]);
  expect(claims.rows.size).toBe(0);
  expect(logs.map((row) => row.detail)).toEqual(["missing_ticket_url", "invalid_invite_url"]);
  expect(logs.every((row) => row.status === "failed" && row.provider === "ghl")).toBe(true);
  expect(ghlTemplateUrlProblem("support_rep_login", { login_url: "" })).toBe("missing_login_url");
  expect(ghlTemplateUrlProblem("support_rep_login", { login_url: "https://saassuite.ai/support-rep/portal" })).toBeNull();

  let kitPosts = 0;
  let released = false;
  let completed = false;
  const refused = await runLynkificDelivery({
    claimed: true,
    completed: false,
    payload: kitPurchasedPayload({
      email: "ada@example.com",
      phone: "",
      name: "Ada",
      lineIds: ["kit"],
      amountCentsTotal: 2700,
      comped: false,
      promotionCode: null,
      checkoutSessionId: "cs_live_url",
      loginUrl: "https://saassuite.ai/signup",
      magicLink: "",
      purchasedAt: "2026-10-23T00:00:00.000Z",
    }),
    url: "https://hooks.example/kit",
    post: async () => {
      kitPosts += 1;
      return { ok: true, status: 200 };
    },
    release: async () => {
      released = true;
    },
    complete: async () => {
      completed = true;
    },
  });
  expect(refused).toBe("missing_url");
  expect(kitPurchasedUrlProblem({ login_url: "https://saassuite.ai/signup", magic_link: "" })).toBe("missing_magic_link");
  expect(kitPosts).toBe(0);
  expect(released).toBe(true);
  expect(completed).toBe(false);

  const badCheckout = queuePayload();
  badCheckout.checkout_url = "http://saassuite.ai/one-feature-kit/checkout";
  let checkoutPosts = 0;
  expect(await attemptKitCheckoutStarted(badCheckout, "https://hooks.example/started", async () => {
    checkoutPosts += 1;
    return { ok: true, status: 200 };
  })).toBe("missing_url");
  expect(checkoutPosts).toBe(0);
});

test("a duplicate post is skipped, a 502 releases, a timeout holds, and a 2xx completes", async () => {
  expect(ghlEmailDedupeKey("ticket_confirmation", "ticket-9")).toBe("ticket_confirmation:ticket-9");
  expect(ghlEmailDedupeKey("admin_invite", "invite-2")).toBe("admin_invite:invite-2");
  expect(ghlEmailDedupeKey("support_rep_login", "rep-1", "code-9")).toBe("support_rep_login:rep-1:code-9");
  expect(ghlEmailDedupeKey("checkout_started", "cs_live_a")).toBe("checkout_started:cs_live_a");
  expect(ghlEmailDedupeKey("support_rep_login", "rep-1")).toBeNull();

  const claims = memoryGhlEmailClaims();
  const urls: string[] = [];
  const fetchImpl: GhlEmailFetch = async (url, init) => {
    urls.push(url);
    const body = JSON.parse(init.body) as { code?: string };
    if (body.code === "502") return { ok: false, status: 502 };
    if (body.code === "hang") throw new Error("timed out");
    return { ok: true, status: 200 };
  };
  const base = {
    getEnv: ticketEnv("https://hooks.example.test/ticket"),
    fetchImpl,
    claims,
    log: async () => {},
  };
  const payload = {
    email: "pat@example.com",
    full_name: "Pat Example",
    ticket_url: TICKET,
  };
  const first = await postGhlEmailEvent("ticket_confirmation", payload, {
    ...base,
    dedupeKey: "ticket_confirmation:ticket-9",
  });
  const again = await postGhlEmailEvent("ticket_confirmation", payload, {
    ...base,
    dedupeKey: "ticket_confirmation:ticket-9",
  });
  expect(first).toEqual({ ok: true, status: "sent", detail: null });
  expect(again).toEqual({ ok: true, status: "duplicate", detail: "duplicate" });
  expect(claims.rows.get("ticket_confirmation:ticket-9")?.completed).toBe(true);
  expect(urls).toHaveLength(1);

  const failed = await postGhlEmailEvent("ticket_confirmation", { ...payload, code: "502" }, {
    ...base,
    dedupeKey: "ticket_confirmation:ticket-502",
  });
  expect(failed).toEqual({ ok: false, status: "failed", detail: "http_502" });
  expect(claims.rows.get("ticket_confirmation:ticket-502")?.completed).toBe(false);
  expect(claims.rows.get("ticket_confirmation:ticket-502")?.leaseUntil).toBe(0);
  const retried = await postGhlEmailEvent("ticket_confirmation", payload, {
    ...base,
    dedupeKey: "ticket_confirmation:ticket-502",
  });
  expect(retried.status).toBe("sent");

  const held = await postGhlEmailEvent("ticket_confirmation", { ...payload, code: "hang" }, {
    ...base,
    dedupeKey: "ticket_confirmation:ticket-hang",
  });
  expect(held).toEqual({ ok: false, status: "failed", detail: "request_failed" });
  expect(claims.rows.get("ticket_confirmation:ticket-hang")?.completed).toBe(false);
  expect((claims.rows.get("ticket_confirmation:ticket-hang")?.leaseUntil ?? 0) > Date.now()).toBe(true);
  const overlap = await postGhlEmailEvent("ticket_confirmation", payload, {
    ...base,
    dedupeKey: "ticket_confirmation:ticket-hang",
  });
  expect(overlap).toEqual({ ok: false, status: "overlap", detail: "in_progress" });

  const checkoutClaims = memoryGhlEmailClaims();
  const startedLogs: string[] = [];
  const notice = checkoutInput();
  const sent = await queueKitCheckoutStarted(notice, {
    claims: checkoutClaims,
    post: async () => ({ ok: true, status: 200 }),
    onResult: (result) => {
      startedLogs.push(result);
    },
  });
  const duplicate = await queueKitCheckoutStarted(notice, {
    claims: checkoutClaims,
    post: async () => {
      throw new Error("should not post");
    },
    onResult: (result) => {
      startedLogs.push(result);
    },
  });
  expect(sent).toBe("sent");
  expect(duplicate).toBe("duplicate");
  expect(startedLogs).toEqual(["sent", "duplicate"]);
  expect(checkoutClaims.rows.get("checkout_started:cs_live_a1b2c3")?.completed).toBe(true);

  let checkoutReleased = false;
  const rejected = await queueKitCheckoutStarted(notice, {
    claims: memoryGhlEmailClaims(),
    post: async () => ({ ok: false, status: 500 }),
  });
  const holding = memoryGhlEmailClaims();
  const timedOut = await queueKitCheckoutStarted({ ...notice, checkoutSessionId: "cs_live_timeout" }, {
    claims: holding,
    timeoutMs: 30,
    post: (_url, _body, signal) => new Promise(() => {
      signal.addEventListener("abort", () => undefined);
    }),
  });
  expect(rejected).toBe("failed");
  expect(timedOut).toBe("failed");
  expect(holding.rows.get("checkout_started:cs_live_timeout")?.completed).toBe(false);
  expect((holding.rows.get("checkout_started:cs_live_timeout")?.leaseUntil ?? 0) > Date.now()).toBe(true);
  expect(checkoutReleased).toBe(false);
});

test("an onboarding timeout holds the claim and a portal invite still does not post", async () => {
  let released = false;
  let completed = false;
  const held = await runClaimedOnboardingNotify({
    plan: { sendSlack: false, sendGhl: true, finish: false, status: "send" },
    prior: { slack: "sent" },
    sendSlack: async () => "sent",
    sendGhl: async () => "uncertain",
    log: async () => undefined,
    complete: async () => {
      completed = true;
    },
    release: async () => {
      released = true;
    },
  });
  expect(held.ghl).toBe("uncertain");
  expect(released).toBe(false);
  expect(completed).toBe(false);

  let fetched = false;
  const portal = await postGhlEmailEvent("portal_invite", {
    email: "location@agency.com",
    full_name: "Riley North",
  }, {
    dedupeKey: "portal_invite:should-not-claim",
    claims: memoryGhlEmailClaims(),
    getEnv: () => "https://hooks.example.test/portal",
    fetchImpl: async () => {
      fetched = true;
      return { ok: true, status: 200 };
    },
    log: async () => {},
  });
  expect(fetched).toBe(false);
  expect(portal.status).toBe("missing_url");

  const migration = readFileSync("supabase/migrations/20261023130000_ghl_email_claims.sql", "utf8");
  expect(migration).toContain("CREATE TABLE public.ghl_email_claims");
  expect(migration).toContain("claim_ghl_email");
  expect(migration).toContain("interval '5 minutes'");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.claim_ghl_email(text) TO service_role");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.claim_ghl_email(text) FROM PUBLIC, anon, authenticated");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.ghl_email_claim_touch() FROM PUBLIC, anon, authenticated");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.ghl_email_claim_touch() TO service_role");

  const ticket = readFileSync("supabase/functions/create-ticket-from-chat/index.ts", "utf8");
  const invite = readFileSync("supabase/functions/invite-account-admin/index.ts", "utf8");
  const rep = readFileSync("supabase/functions/support-rep-auth/index.ts", "utf8");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  const portalApi = readFileSync("supabase/functions/ghl-connection/index.ts", "utf8");
  expect(ticket).toContain('ghlEmailDedupeKey("ticket_confirmation"');
  expect(invite).toContain('ghlEmailDedupeKey("admin_invite"');
  expect(rep).toContain('ghlEmailDedupeKey("support_rep_login"');
  expect(payment).toContain("ghlEmailClaims(");
  expect(payment).toContain("claims: ghlEmailClaims(kitDb())");
  expect(portalApi).not.toContain("postGhlEmailEvent");
  expect(portalApi).not.toContain("api.resend.com");
  expect(ticket).not.toContain("api.resend.com");
  expect(invite).not.toContain("api.resend.com");
  expect(rep).not.toContain("api.resend.com");
});

function queuePayload() {
  return {
    event: "saassuite.kit_checkout_started" as const,
    email: "ada@example.com",
    phone: "",
    first_name: "Ada",
    last_name: "",
    line_ids: ["kit"] as string[],
    amount_cents_total: 2700,
    promotion_code: null,
    checkout_session_id: "cs_live_a1b2c3",
    checkout_url: "https://saassuite.ai/one-feature-kit/checkout",
    started_at: "2026-10-23T00:00:00.000Z",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    source: "saassuite" as const,
  };
}

function queueName(name: string) {
  return kitCheckoutStartedPayload({
    email: "ada@example.com",
    phone: "",
    name,
    lineIds: ["kit"],
    amountCentsTotal: kitTotal(["kit"]),
    promotionCode: null,
    checkoutSessionId: "cs_live_a1b2c3",
    startedAt: "2026-10-23T00:00:00.000Z",
  });
}

function checkoutInput(): KitCheckoutStartedInput {
  return {
    livemode: true,
    email: "ada@example.com",
    phone: "",
    name: "Ada Lovelace",
    lineIds: ["kit"],
    amountCentsTotal: kitTotal(["kit"]),
    promotionCode: null,
    checkoutSessionId: "cs_live_a1b2c3",
    startedAt: "2026-10-23T00:00:00.000Z",
    webhookUrl: "https://hooks.example/started",
  };
}

test("kit phone is stripped and logo_url stays https or blank", () => {
  const purchased = kitPurchasedPayload({
    email: "ada@example.com",
    phone: "<b>+1</b> 337\u0007<script>x</script>",
    name: "Ada",
    lineIds: ["kit"],
    amountCentsTotal: 2700,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_live_phone",
    loginUrl: "https://saassuite.ai/auth?email=ada%40example.com",
    magicLink: "https://auth.example/verify?token=1&next=1",
    purchasedAt: "2026-10-23T00:00:00.000Z",
  });
  expect(purchased.phone).toBe("+1 337 x");
  expect(purchased.phone).not.toContain("<");
  expect(purchased.magic_link).toBe("https://auth.example/verify?token=1&next=1");

  const logo = "https://files.example/logo.png?a=1&b=2";
  const row = (phone: string, logoUrl: string): OnboardingRow => ({
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-10-22T18:04:00.000Z",
    checkout_id: null,
    first_name: "Ada",
    email: "ada@example.com",
    phone,
    order_lines: [],
    answers: { "Link to your logo": logoUrl },
    source: "one-feature-kit",
  });
  const httpsLogo = buildKitOnboardingNotice(row("<img src=x>+1337\u0001", logo), []).webhook;
  expect(httpsLogo.phone).toBe("+1337");
  expect(httpsLogo.logo_url).toBe(logo);
  expect(String(httpsLogo.logo_url)).not.toContain("&amp;");

  expect(buildKitOnboardingNotice(row("+1 337", "http://files.example/logo.png"), []).webhook.logo_url).toBe("");
  expect(buildKitOnboardingNotice(row("+1 337", "javascript:alert(1)"), []).webhook.logo_url).toBe("");
  expect(buildKitOnboardingNotice(row("+1 337", ""), []).webhook.logo_url).toBe("");
  expect(buildKitOnboardingNotice(row("+1 337", "http://files.example/logo.png"), []).webhook.phone).toBe("+1 337");
});

function onboardingName(firstName: string, email: string) {
  const row: OnboardingRow = {
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-10-22T18:04:00.000Z",
    checkout_id: null,
    first_name: firstName,
    email,
    phone: "",
    order_lines: [],
    answers: { "Business / brand name for your app": `A & B <b>Co</b>` },
    source: "one-feature-kit",
  };
  return buildKitOnboardingNotice(row, []).webhook;
}
