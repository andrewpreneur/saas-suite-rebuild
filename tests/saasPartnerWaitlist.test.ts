import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  SAAS_PARTNER_MAX_LOGO_BYTES,
  SAAS_PARTNER_MIN_FILL_MS,
  SAAS_PARTNER_RATE_LIMIT,
  SAAS_PARTNER_WEBHOOK_EVENT,
  bytesToBase64,
  evaluateSaasPartnerSubmission,
  normalizeHttpUrl,
  saasPartnerClientIp,
  sanitizeSvg,
} from "../supabase/functions/_shared/saasPartnerWaitlist";
import {
  handleSaasPartnerWaitlist,
  logoBytesWithinLimit,
  type SaasPartnerInsert,
  type SaasPartnerStore,
} from "../supabase/functions/saas-partner-waitlist/handler";
import { readWaitlistInvoke } from "../src/lib/saasPartnerSubmit";
import { mockSaasPartnerInvoke } from "../src/lib/saasPartnerMock";

const NOW = Date.parse("2026-10-24T18:00:00.000Z");
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#111"/></svg>`;

function body(overrides: Record<string, unknown> = {}) {
  return {
    business_name: "Acme Analytics",
    website: "https://acme.example",
    contact_name: "Ada Lovelace",
    email: "Ada@Acme.example",
    phone: "+1 555 010 0100",
    started_at: NOW - 5000,
    utm_source: "directory",
    ...overrides,
  };
}

function memory(count = 0) {
  const rows: SaasPartnerInsert[] = [];
  const logos = new Map<string, { bytes: Uint8Array; contentType: string }>();
  let removed: string[] = [];
  const store: SaasPartnerStore = {
    async countRecent() {
      return { count };
    },
    async insert(row) {
      if (rows.some((existing) => existing.email === row.email && existing.website === row.website)) {
        return { error: "duplicate key", code: "23505" };
      }
      rows.push(row);
      return { id: row.id };
    },
    async uploadLogo(path, bytes, contentType) {
      logos.set(path, { bytes, contentType });
      return {};
    },
    async removeLogo(path) {
      removed.push(path);
      logos.delete(path);
    },
  };
  return { rows, logos, removed: () => removed, store };
}

function env(store: SaasPartnerStore | null, webhookUrl: string | null = null) {
  return {
    nowMs: NOW,
    webhookUrl,
    ip: "203.0.113.10",
    userAgent: "WaitlistTest/1.0",
    store,
  };
}

async function post(payload: Record<string, unknown>, store: SaasPartnerStore | null, webhookUrl: string | null = null, poster?: (url: string, body: string) => Promise<{ ok: boolean }>) {
  const response = await handleSaasPartnerWaitlist(
    new Request("https://auth.saassuite.ai/functions/v1/saas-partner-waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify(payload),
    }),
    env(store, webhookUrl),
    poster,
  );
  return { status: response.status, body: await response.json() };
}

describe("saas partner validation", () => {
  test("accepts a complete submission and normalizes a URL without a scheme", () => {
    const decision = evaluateSaasPartnerSubmission(body({ website: "acme.example/pricing" }), NOW);
    expect(decision.kind).toBe("ok");
    if (decision.kind !== "ok") return;
    expect(decision.row.website).toBe("https://acme.example/pricing");
    expect(decision.row.email).toBe("ada@acme.example");
    expect(decision.row.phone).toBe("+1 555 010 0100");
    expect(decision.row.utm_source).toBe("directory");
    expect(decision.logo).toBeNull();
  });

  test("normalizes a bare host and rejects a non-http URL", () => {
    expect(normalizeHttpUrl("acme.example")).toBe("https://acme.example/");
    expect(normalizeHttpUrl("http://acme.example/path")).toBe("http://acme.example/path");
    expect(normalizeHttpUrl("ftp://acme.example")).toBeNull();
    expect(normalizeHttpUrl("notaurl")).toBeNull();
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  test.each([
    ["business_name", { business_name: " " }, "business name"],
    ["website", { website: "" }, "website"],
    ["contact_name", { contact_name: "" }, "name"],
    ["email", { email: "" }, "email"],
    ["phone", { phone: "" }, "phone"],
  ])("requires %s", (_field, overrides, snippet) => {
    const decision = evaluateSaasPartnerSubmission(body(overrides), NOW);
    expect(decision.kind).toBe("invalid");
    if (decision.kind !== "invalid") return;
    expect(decision.error.toLowerCase()).toContain(snippet);
  });

  test("rejects an invalid email and an invalid affiliate link", () => {
    const email = evaluateSaasPartnerSubmission(body({ email: "ada@acme" }), NOW);
    expect(email.kind).toBe("invalid");
    if (email.kind === "invalid") expect(email.fields.email).toContain("email");
    const link = evaluateSaasPartnerSubmission(body({ affiliate_link: "not a link" }), NOW);
    expect(link.kind).toBe("invalid");
    if (link.kind === "invalid") expect(link.fields.affiliate_link).toContain("affiliate");
    const blank = evaluateSaasPartnerSubmission(body({ affiliate_link: "  " }), NOW);
    expect(blank.kind).toBe("ok");
  });

  test("rejects a too-fast submit and a script-bearing SVG", () => {
    const fast = evaluateSaasPartnerSubmission(body({ started_at: NOW - 200 }), NOW);
    expect(fast.kind).toBe("invalid");
    if (fast.kind === "invalid") expect(fast.fields.started_at).toContain("moment");
    const future = evaluateSaasPartnerSubmission(body({ started_at: NOW + 60_000 }), NOW);
    expect(future.kind).toBe("invalid");
    if (future.kind === "invalid") expect(future.fields.started_at).toContain("moment");
    expect(sanitizeSvg(SVG)).toContain("<rect");
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><use href=https://evil.example/a.svg /></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href=https://evil.example/a.svg /></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://evil.example/a.png)"/></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(#g)"/></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><use href="#icon"/></svg>`)).toContain('href="#icon"');
    const logo = evaluateSaasPartnerSubmission(
      body({
        logo_base64: bytesToBase64(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`)),
        logo_content_type: "image/svg+xml",
      }),
      NOW,
    );
    expect(logo.kind).toBe("invalid");
    if (logo.kind === "invalid") expect(logo.fields.logo).toContain("SVG");
  });

  test("accepts a PNG and rejects an oversized or non-image logo", () => {
    const ok = evaluateSaasPartnerSubmission(
      body({ logo_base64: bytesToBase64(PNG), logo_content_type: "image/png" }),
      NOW,
    );
    expect(ok.kind).toBe("ok");
    if (ok.kind === "ok") expect(ok.logo?.ext).toBe("png");
    const big = new Uint8Array(SAAS_PARTNER_MAX_LOGO_BYTES + 1);
    big.set(PNG, 0);
    const oversized = evaluateSaasPartnerSubmission(
      body({ logo_base64: bytesToBase64(big), logo_content_type: "image/png" }),
      NOW,
    );
    expect(oversized.kind).toBe("invalid");
    const gif = evaluateSaasPartnerSubmission(
      body({ logo_base64: bytesToBase64(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), logo_content_type: "image/gif" }),
      NOW,
    );
    expect(gif.kind).toBe("invalid");
    if (gif.kind === "invalid") expect(gif.fields.logo).toContain("PNG");
  });
});

describe("saas partner edge function", () => {
  test("saves a JSON submission with the service store and does not reveal the logo path", async () => {
    const saved = memory();
    const posts: string[] = [];
    const result = await post(
      body({
        logo_base64: bytesToBase64(PNG),
        logo_content_type: "image/png",
        affiliate_link: "partners.example/ada",
        status: "approved",
      }),
      saved.store,
      "https://hooks.example/saas-partner",
      async (_url, payload) => {
        posts.push(payload);
        return { ok: true };
      },
    );
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.logo_path).toBeUndefined();
    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0].status).toBe("pending");
    expect(saved.rows[0].email).toBe("ada@acme.example");
    expect(saved.rows[0].website).toBe("https://acme.example/");
    expect(saved.rows[0].affiliate_link).toBe("https://partners.example/ada");
    expect(saved.rows[0].logo_path).toMatch(/\.png$/);
    expect(saved.rows[0].ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.rows[0].ip_hash).not.toContain("203.0.113.10");
    expect(saved.logos.get(saved.rows[0].logo_path || "")?.contentType).toBe("image/png");
    expect(posts).toHaveLength(1);
    const webhook = JSON.parse(posts[0]);
    expect(webhook.event).toBe(SAAS_PARTNER_WEBHOOK_EVENT);
    expect(webhook.has_logo).toBe(true);
    expect(webhook.email).toBe("ada@acme.example");
    expect(JSON.stringify(webhook)).not.toContain(bytesToBase64(PNG).slice(0, 24));
  });

  test("keys the rate limit on the platform address or the last forwarding hop", () => {
    const headers = (values: Record<string, string>) => ({
      get: (name: string) => values[name.toLowerCase()] ?? null,
    });
    expect(saasPartnerClientIp(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.50" }))).toBe("203.0.113.50");
    expect(
      saasPartnerClientIp(
        headers({ "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "1.2.3.4, 198.51.100.8" }),
      ),
    ).toBe("203.0.113.50");
    expect(saasPartnerClientIp(headers({ "x-real-ip": "203.0.113.60", "x-forwarded-for": "1.2.3.4" }))).toBe(
      "203.0.113.60",
    );
    expect(saasPartnerClientIp(headers({}))).toBe("unknown");
  });

  test("rejects an oversized multipart body before buffering the logo", async () => {
    let read = false;
    const req = {
      method: "POST",
      headers: {
        get(name: string) {
          const key = name.toLowerCase();
          if (key === "content-type") return "multipart/form-data; boundary=----bound";
          if (key === "content-length") return String(SAAS_PARTNER_MAX_LOGO_BYTES + 1);
          return null;
        },
      },
      formData: async () => {
        read = true;
        return new FormData();
      },
      json: async () => ({}),
    } as unknown as Request;
    const saved = memory();
    const response = await handleSaasPartnerWaitlist(req, env(saved.store));
    const payload = await response.json();
    expect(read).toBe(false);
    expect(response.status).toBe(400);
    expect(payload.field).toBe("logo");
    expect(payload.error).toContain("2 MB");
    expect(saved.rows).toHaveLength(0);

    let buffered = false;
    const bytes = await logoBytesWithinLimit({
      size: SAAS_PARTNER_MAX_LOGO_BYTES + 1,
      arrayBuffer: async () => {
        buffered = true;
        return new ArrayBuffer(0);
      },
    });
    expect(bytes).toBeNull();
    expect(buffered).toBe(false);
  });

  test("accepts a multipart logo and required fields without an affiliate link", async () => {
    const saved = memory();
    const form = new FormData();
    form.set("business_name", "Northwind");
    form.set("website", "northwind.example");
    form.set("contact_name", "Grace Hopper");
    form.set("email", "grace@northwind.example");
    form.set("phone", "5550100199");
    form.set("started_at", String(NOW - SAAS_PARTNER_MIN_FILL_MS - 10));
    form.set("logo", new File([PNG], "mark.png", { type: "image/png" }));
    const response = await handleSaasPartnerWaitlist(
      new Request("https://auth.saassuite.ai/functions/v1/saas-partner-waitlist", { method: "POST", body: form }),
      env(saved.store),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(saved.rows[0].affiliate_link).toBeNull();
    expect(saved.rows[0].website).toBe("https://northwind.example/");
    expect(saved.rows[0].logo_path?.endsWith(".png")).toBe(true);
  });

  test("drops a honeypot fill without inserting", async () => {
    const saved = memory();
    const result = await post(body({ company_url: "https://spam.example" }), saved.store);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(saved.rows).toHaveLength(0);
  });

  test("rate limits by ip hash and reports a duplicate", async () => {
    const limited = memory(SAAS_PARTNER_RATE_LIMIT);
    const blocked = await post(body(), limited.store);
    expect(blocked.status).toBe(429);
    expect(limited.rows).toHaveLength(0);

    const saved = memory();
    const first = await post(body(), saved.store);
    expect(first.status).toBe(200);
    const second = await post(body({ contact_name: "Ada Lovelace" }), saved.store);
    expect(second.status).toBe(409);
    expect(second.body.error).toContain("already on the waitlist");
    expect(saved.rows).toHaveLength(1);
  });

  test("skips the webhook when the env var is unset and still saves", async () => {
    const saved = memory();
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    let posted = false;
    try {
      const result = await post(body(), saved.store, null, async () => {
        posted = true;
        return { ok: true };
      });
      expect(result.status).toBe(200);
      expect(posted).toBe(false);
      expect(warnings.join("\n")).toContain("GHL_SAAS_PARTNER_WEBHOOK_URL not configured");
    } finally {
      console.warn = original;
    }
  });

  test("a webhook failure does not fail the waitlist save", async () => {
    const saved = memory();
    const result = await post(body(), saved.store, "https://hooks.example/saas-partner", async () => {
      throw new Error("down");
    });
    expect(result.status).toBe(200);
    expect(saved.rows).toHaveLength(1);
  });

  test("removes the logo when the insert hits a duplicate", async () => {
    const saved = memory();
    await post(body({ logo_base64: bytesToBase64(PNG), logo_content_type: "image/png" }), saved.store);
    const again = await post(body({ logo_base64: bytesToBase64(PNG), logo_content_type: "image/png" }), saved.store);
    expect(again.status).toBe(409);
    expect(saved.removed()).toHaveLength(1);
    expect(saved.logos.size).toBe(1);
  });

  test("returns the function error body to the page reader", async () => {
    const parsed = await readWaitlistInvoke({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: async () => ({ error: "Enter a valid email address.", field: "email" }) },
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBe("Enter a valid email address.");
  });
});

describe("saas partner wiring", () => {
  test("the migration locks the table and the private logo bucket", () => {
    const sql = readFileSync("supabase/migrations/20261024181202_saas_partner_waitlist.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.saas_partner_waitlist from public, anon, authenticated");
    expect(sql).toContain("saas-partner-logos");
    expect(sql).toContain("false");
    expect(sql.toLowerCase()).not.toContain("create policy");
    expect(sql).toContain("default 'pending'");
  });

  test("the public page is routed, listed once in the sitemap, and does not print the support phone", () => {
    const page = readFileSync("src/pages/SaasPartner.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");
    const sitemap = readFileSync("public/sitemap.xml", "utf8");
    const config = readFileSync("supabase/config.toml", "utf8");
    const sidebar = readFileSync("src/lib/sidebarNav.ts", "utf8");
    const guard = readFileSync("tests/oneFeatureKitFunnel.test.ts", "utf8");
    expect(page).toContain("MarketingLayout");
    expect(page).toContain("Let us Promote Your SaaS");
    expect(page).toContain("Join the SaaS directory waitlist");
    expect(page).not.toContain("227-0501");
    expect(page).not.toContain("3372270501");
    expect(page.toLowerCase()).not.toContain("resend");
    expect(app).toContain('path="/saaspartner"');
    expect(sidebar).not.toContain("saaspartner");
    expect(sitemap).toContain("https://saassuite.ai/saaspartner");
    expect(sitemap).not.toContain("/one-feature-kit/checkout");
    expect(sitemap).not.toContain("/one-feature-kit/thank-you");
    expect(sitemap.match(/<loc>https:\/\/saassuite\.ai\/blog/g)?.length).toBe(41);
    expect(guard).toContain('expect(sitemap).not.toContain("/one-feature-kit/checkout")');
    expect(config).toContain("[functions.saas-partner-waitlist]");
    expect(config).toMatch(/\[functions\.saas-partner-waitlist\]\nverify_jwt = false/);
    const index = readFileSync("supabase/functions/saas-partner-waitlist/index.ts", "utf8");
    expect(index).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(index).toContain("SAAS_PARTNER_BUCKET");
    expect(index).toContain("saasPartnerClientIp");
    expect(index).not.toContain('split(",")[0]');
    expect(index).not.toContain("SUPABASE_ANON_KEY");
    expect(page).toContain('id="saas-partner-error"');
    expect(page).toContain('field === "started_at"');
    expect(index.toLowerCase()).not.toContain("resend");
    expect(index).not.toContain("getPublicUrl");
  });

  test("the local mock dedupes and discards a honeypot without a network call", () => {
    const host = globalThis as typeof globalThis & { __ssSaasPartner?: { submissions: unknown[]; discarded: string[] } };
    host.__ssSaasPartner = { submissions: [], discarded: [], last: null };
    const first = mockSaasPartnerInvoke(body({ started_at: Date.now() - 5000 }));
    expect(first.data.ok).toBe(true);
    const second = mockSaasPartnerInvoke(body({ started_at: Date.now() - 5000 }));
    expect(second.data.ok).toBe(false);
    if (!second.data.ok) expect(second.data.error).toContain("already on the waitlist");
    const bait = mockSaasPartnerInvoke(body({ company_url: "https://spam.example", email: "other@acme.example", started_at: Date.now() - 5000 }));
    expect(bait.data.ok).toBe(true);
    expect(host.__ssSaasPartner?.submissions).toHaveLength(1);
    expect(host.__ssSaasPartner?.discarded).toEqual(["honeypot"]);
  });
});
