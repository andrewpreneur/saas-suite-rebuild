import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import {
  GHL_EMAIL_WEBHOOK_DEFAULTS,
  ghlEmailBody,
  ghlEmailEventSecret,
  ghlEmailHtml,
  postGhlEmailEvent,
  readGhlEmailWebhookUrl,
  type GhlEmailFetch,
} from "../supabase/functions/_shared/ghl-email-webhook";

const TICKET_URL = "https://hooks.example.test/ticket";

function envWith(url: string | undefined): (name: string) => string | undefined {
  return (name) => (name === "GHL_TICKET_CONFIRMATION_WEBHOOK_URL" ? url : undefined);
}

test("a ticket confirmation is a flat payload with the name split", () => {
  expect(ghlEmailBody("ticket_confirmation", {
    email: "Pat@Example.com",
    full_name: "Pat Example",
    ticket_number: 42,
    ticket_subject: "Your support ticket #42 has been created",
    ticket_url: "https://saassuite.ai/support",
    nested: { skip: true },
    empty: "  ",
  })).toEqual({
    event: "ticket_confirmation",
    email: "pat@example.com",
    first_name: "Pat",
    last_name: "Example",
    full_name: "Pat Example",
    ticket_number: 42,
    ticket_subject: "Your support ticket #42 has been created",
    ticket_url: "https://saassuite.ai/support",
  });
});

test("html fields escape markup before turning newlines into breaks", () => {
  const plain = "Hello <b>Pat</b> & \"friends\"\r\nLine two\nIt's fine";
  const html = "Hello &lt;b&gt;Pat&lt;/b&gt; &amp; &quot;friends&quot;<br>Line two<br>It&#39;s fine";
  expect(ghlEmailHtml(plain)).toBe(html);
  const posted = "Hello Pat &amp; &quot;friends&quot;\nLine two\nIt&#39;s fine";
  const postedHtml = "Hello Pat &amp; &quot;friends&quot;<br>Line two<br>It&#39;s fine";
  expect(ghlEmailBody("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat Example",
    ticket_message: plain,
  })).toMatchObject({
    ticket_message: posted,
    ticket_message_html: postedHtml,
  });
  expect(ghlEmailBody("portal_invite", {
    email: "location@agency.com",
    full_name: "Riley North",
    message: plain,
  }).message_html).toBeUndefined();
  const ticket = ghlEmailBody("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat",
    ticket_message: plain,
  });
  expect(ticket.ticket_message_html).not.toContain("<b>");
  expect(ticket.ticket_message_html).not.toContain("\n");
  expect(String(ticket.ticket_message_html).includes("<br>")).toBe(true);
});

test("an admin invite button says Accept invite only for a new user", () => {
  const base = {
    email: "admin@agency.com",
    full_name: "Sam Lee",
    invite_url: "https://auth.example/verify?token=1",
  };
  expect(ghlEmailBody("admin_invite", { ...base, is_new_user: "yes" }).button_label).toBe("Accept invite");
  expect(ghlEmailBody("admin_invite", { ...base, is_new_user: true }).button_label).toBe("Accept invite");
  expect(ghlEmailBody("admin_invite", { ...base, is_new_user: "no" }).button_label).toBe("Open");
  expect(ghlEmailBody("admin_invite", { ...base, is_new_user: false }).button_label).toBe("Open");
  expect(ghlEmailBody("admin_invite", base).button_label).toBe("Open");
});

test("each email event has its own webhook secret", () => {
  expect(ghlEmailEventSecret("ticket_confirmation")).toBe("GHL_TICKET_CONFIRMATION_WEBHOOK_URL");
  expect(ghlEmailEventSecret("admin_invite")).toBe("GHL_ADMIN_INVITE_WEBHOOK_URL");
  expect(ghlEmailEventSecret("support_rep_login")).toBe("GHL_SUPPORT_REP_LOGIN_WEBHOOK_URL");
  expect(ghlEmailEventSecret("portal_invite")).toBeNull();
  expect(ghlEmailEventSecret("kit_login")).toBeNull();
  expect(ghlEmailEventSecret("kit_purchased")).toBeNull();
});

test("a 2xx post is logged as sent and does not include the one-time code in the log", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const fetchImpl: GhlEmailFetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200 };
  };
  const result = await postGhlEmailEvent("support_rep_login", {
    email: "rep@example.com",
    full_name: "Ada Lovelace",
    code: "123456",
    login_url: "https://saassuite.ai/support-rep/portal",
    subject: "Your SaaSSuite support portal code",
  }, {
    source: "support-rep-auth",
    getEnv: (name) => (name === "GHL_SUPPORT_REP_LOGIN_WEBHOOK_URL" ? "https://hooks.example.test/login" : undefined),
    fetchImpl,
    log: async (row) => {
      logs.push(row);
    },
  });
  expect(result).toEqual({ ok: true, status: "sent", detail: null });
  expect(calls).toEqual([{
    url: "https://hooks.example.test/login",
    body: {
      event: "support_rep_login",
      email: "rep@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
      code: "123456",
      login_url: "https://saassuite.ai/support-rep/portal",
      subject: "Your SaaSSuite support portal code",
    },
  }]);
  expect(logs[0]).toMatchObject({
    provider: "ghl",
    status: "sent",
    templateKey: "support_rep_login",
    source: "support-rep-auth",
    userEmail: "rep@example.com",
  });
  expect(JSON.stringify(logs[0])).not.toContain("123456");
});

test("an unset secret uses the coded webhook and a blank secret skips", async () => {
  const calls: string[] = [];
  const fetchImpl: GhlEmailFetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 200 };
  };
  const unset = await postGhlEmailEvent("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat Example",
    ticket_number: 7,
    ticket_url: "https://saassuite.ai/support",
  }, {
    source: "create-ticket-from-chat",
    getEnv: () => undefined,
    fetchImpl,
    log: async () => {},
  });
  const override = await postGhlEmailEvent("admin_invite", {
    email: "admin@agency.com",
    full_name: "Sam Lee",
    invite_url: "https://auth.example/verify?token=1",
  }, {
    getEnv: (name) => (name === "GHL_ADMIN_INVITE_WEBHOOK_URL" ? "https://hooks.example.test/admin" : undefined),
    fetchImpl,
    log: async () => {},
  });
  const logs: Array<Record<string, unknown>> = [];
  const blank = await postGhlEmailEvent("support_rep_login", {
    email: "rep@example.com",
    full_name: "Ada",
    code: "123456",
  }, {
    getEnv: (name) => (name === "GHL_SUPPORT_REP_LOGIN_WEBHOOK_URL" ? "  " : undefined),
    fetchImpl,
    log: async (row) => {
      logs.push(row);
    },
  });
  expect(unset).toEqual({ ok: true, status: "sent", detail: null });
  expect(override).toEqual({ ok: true, status: "sent", detail: null });
  expect(calls).toEqual([
    GHL_EMAIL_WEBHOOK_DEFAULTS.ticket_confirmation,
    "https://hooks.example.test/admin",
  ]);
  expect(blank).toEqual({ ok: false, status: "missing_url", detail: "missing_url" });
  expect(logs[0]).toMatchObject({ provider: "ghl", status: "failed", detail: "missing_url" });
  expect(GHL_EMAIL_WEBHOOK_DEFAULTS.portal_invite).toBeUndefined();
});

test("a portal invite never posts, even when its old webhook secret is set", async () => {
  let fetched = false;
  const result = await postGhlEmailEvent("portal_invite", {
    email: "location@agency.com",
    full_name: "Riley North",
    message: "Hello",
  }, {
    getEnv: (name) => (name === "GHL_PORTAL_INVITE_WEBHOOK_URL"
      ? "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/ignored"
      : undefined),
    fetchImpl: async () => {
      fetched = true;
      return { ok: true, status: 200 };
    },
    log: async () => {},
  });
  expect(fetched).toBe(false);
  expect(result).toEqual({ ok: false, status: "missing_url", detail: "missing_url" });
  expect(readGhlEmailWebhookUrl("portal_invite", (name) => (
    name === "GHL_PORTAL_INVITE_WEBHOOK_URL" ? "https://hooks.example.test/portal" : undefined
  ))).toBeNull();
});

test("GoHighLevel mapped fields keep the names the workflows use", () => {
  const ticket = ghlEmailBody("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat Example",
    ticket_number: 42,
    ticket_subject: "Your support ticket #42 has been created",
    ticket_url: "https://saassuite.ai/support",
    issue_category: "Billing",
    ticket_message: "Hi Pat\nCategory: Billing",
  });
  expect(ticket).toMatchObject({
    ticket_subject: "Your support ticket #42 has been created",
    ticket_message_html: "Hi Pat<br>Category: Billing",
    ticket_number: 42,
    issue_category: "Billing",
    ticket_url: "https://saassuite.ai/support",
  });
  const admin = ghlEmailBody("admin_invite", {
    email: "admin@agency.com",
    full_name: "Sam Lee",
    subject: "You've been added as an admin on North Agency",
    inviter_name: "Jordan Owner",
    agency_name: "North Agency",
    invite_url: "https://auth.example/verify?token=1",
    is_new_user: "yes",
  });
  expect(admin).toMatchObject({
    subject: "You&#39;ve been added as an admin on North Agency",
    inviter_name: "Jordan Owner",
    agency_name: "North Agency",
    invite_url: "https://auth.example/verify?token=1",
    button_label: "Accept invite",
  });
  const rep = ghlEmailBody("support_rep_login", {
    email: "rep@example.com",
    full_name: "Ada Lovelace",
    subject: "Your SaaSSuite support portal code",
    code: "123456",
    expires_minutes: 15,
    login_url: "https://saassuite.ai/support-rep/portal",
  });
  expect(rep).toMatchObject({
    subject: "Your SaaSSuite support portal code",
    code: "123456",
    expires_minutes: 15,
    login_url: "https://saassuite.ai/support-rep/portal",
  });
});

test("an HTTP error and a thrown fetch are failed sends and do not throw", async () => {
  const logs: string[] = [];
  const http = await postGhlEmailEvent("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat",
    ticket_url: "https://saassuite.ai/support",
  }, {
    getEnv: envWith(TICKET_URL),
    fetchImpl: async () => ({ ok: false, status: 502 }),
    log: async (row) => {
      logs.push(String(row.detail));
    },
  });
  const thrown = await postGhlEmailEvent("ticket_confirmation", {
    email: "pat@example.com",
    full_name: "Pat",
    ticket_url: "https://saassuite.ai/support",
  }, {
    getEnv: envWith(TICKET_URL),
    fetchImpl: async () => {
      throw new Error("network down");
    },
    log: async (row) => {
      logs.push(String(row.detail));
    },
  });
  expect(http).toEqual({ ok: false, status: "failed", detail: "http_502" });
  expect(thrown).toEqual({ ok: false, status: "failed", detail: "request_failed" });
  expect(logs).toEqual(["http_502", "request_failed"]);
});

test("an invite link stays on the payload and a blank URL secret is missing", async () => {
  const calls: unknown[] = [];
  const result = await postGhlEmailEvent("admin_invite", {
    email: "admin@agency.com",
    full_name: "Sam Lee",
    invite_url: "https://auth.example/verify?token=1",
    inviter_name: "Jordan Owner",
    agency_name: "North Agency",
  }, {
    source: "invite-account-admin",
    getEnv: (name) => (name === "GHL_ADMIN_INVITE_WEBHOOK_URL" ? "   " : undefined),
    fetchImpl: async () => {
      calls.push(true);
      return { ok: true, status: 200 };
    },
    log: async () => {},
  });
  expect(result.status).toBe("missing_url");
  expect(calls).toEqual([]);
  expect(ghlEmailBody("admin_invite", {
    email: "admin@agency.com",
    full_name: "Sam Lee",
    invite_url: "https://auth.example/verify?token=1",
    inviter_name: "Jordan Owner",
    agency_name: "North Agency",
  })).toMatchObject({
    event: "admin_invite",
    invite_url: "https://auth.example/verify?token=1",
    inviter_name: "Jordan Owner",
    agency_name: "North Agency",
    first_name: "Sam",
    last_name: "Lee",
  });
});

test("a support rep login posts the code once, on the GoHighLevel hook", () => {
  const auth = readFileSync("supabase/functions/support-rep-auth/index.ts", "utf8");
  const code = auth.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  expect(code.match(/postGhlEmailEvent\(/g)).toHaveLength(1);
  expect(code).toContain('postGhlEmailEvent("support_rep_login"');
  expect(code.match(/await emailCode\(/g)).toHaveLength(1);
  expect(code).not.toContain("notifyWebhook");
  expect(code).not.toContain("SUPPORT_REP_WEBHOOK_URL");
  expect(code).not.toContain('"support_rep_login_code"');
  expect(code).not.toContain("api.resend.com");
});

test("the portal invite returns a shareable link and does not mail it", () => {
  const api = readFileSync("supabase/functions/ghl-connection/index.ts", "utf8");
  const ui = readFileSync("src/components/highlevel/PortalInviteBar.tsx", "utf8");
  const sender = readFileSync("supabase/functions/_shared/ghl-email-webhook.ts", "utf8");
  expect(api).toContain("invite_link: inviteLink");
  expect(api).toContain("emailed: false");
  expect(api).not.toContain("postGhlEmailEvent");
  expect(api).not.toContain("GHL_PORTAL_INVITE_WEBHOOK_URL");
  expect(api).not.toContain("api.resend.com");
  expect(api).not.toContain("RESEND_API_KEY");
  expect(ui).toContain('ghl<{ invite_link?: string; portal_url?: string }>("invite_portal"');
  expect(ui).toContain("navigator.clipboard.writeText(link)");
  expect(ui).not.toContain("Send to");
  expect(sender).not.toContain("portal_invite: \"GHL_PORTAL_INVITE_WEBHOOK_URL\"");
  expect(sender).not.toContain("api.resend.com");
});
