import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  PLATFORM_ADMIN_EMAIL,
  classifyCancelAccessUntil,
  decideSuspendAccess,
  isExistingPlatformAdminEmail,
  parseCancelAccessInstant,
  readBearerToken,
  resolveSessionEmail,
  sessionEmailFromAuthUser,
  suspendOverrideAllowed,
} from "../supabase/functions/_shared/suspendAccessGuard";
import {
  CANCELLATION_WEBHOOK_URL,
  handleSuspendUserAccess,
  type SuspendAccessDeps,
  type SuspendUserRow,
} from "../supabase/functions/suspend-user-access/handler";

const NOW = Date.parse("2026-11-08T15:39:00.000Z");
const FUTURE = "2026-11-11T22:50:18.000Z";
const EQUAL = "2026-11-08T15:39:00.000Z";
const EXPIRED = "2026-11-08T15:38:59.999Z";
const ADMIN = PLATFORM_ADMIN_EMAIL;
const OWNER = "owner@agency.example";
const SECRET = "webhook-secret-for-tests";

type UserResult = { user: { email?: string | null } | null; error: boolean };

function row(overrides: Partial<SuspendUserRow> = {}): SuspendUserRow {
  return {
    approval: "YES",
    billing_state: "ACTIVE",
    cancel_access_until: null,
    ...overrides,
  };
}

function harness(options: {
  users?: Map<string, UserResult>;
  secret?: string | null;
  found?: { row: SuspendUserRow | null; error?: string };
  suspended?: { suspended: boolean; error?: string };
  post?: (email: string) => Promise<void>;
} = {}) {
  const users = options.users ?? new Map<string, UserResult>();
  const calls = {
    find: [] as string[],
    suspend: [] as string[],
    webhooks: [] as string[],
    tokens: [] as string[],
  };
  const deps: SuspendAccessDeps = {
    nowMs: NOW,
    webhookSecret: options.secret === undefined ? null : options.secret,
    async findUser(email) {
      calls.find.push(email);
      return options.found ?? { row: row() };
    },
    async suspendUser(email) {
      calls.suspend.push(email);
      return options.suspended ?? { suspended: true };
    },
    async postCancellation(email) {
      calls.webhooks.push(email);
      if (options.post) await options.post(email);
    },
    async getUser(token) {
      calls.tokens.push(token);
      return users.get(token) ?? { user: null, error: true };
    },
  };
  return { calls, deps };
}

function request(body: unknown, authorization?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization) headers.set("Authorization", authorization);
  return new Request("https://example.test/suspend-user-access", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function post(
  body: Record<string, unknown>,
  deps: SuspendAccessDeps,
  authorization?: string,
) {
  const response = await handleSuspendUserAccess(request(body, authorization), deps);
  const payload = await response.json();
  return { status: response.status, payload };
}

describe("cancel_access_until classification", () => {
  test("a future instant is the only protected window", () => {
    expect(classifyCancelAccessUntil(FUTURE, NOW)).toEqual({ state: "future", until: FUTURE });
    expect(classifyCancelAccessUntil(`  ${FUTURE}  `, NOW).state).toBe("future");
    expect(classifyCancelAccessUntil("2026-11-11T16:50:18.000-06:00", NOW)).toEqual({
      state: "future",
      until: "2026-11-11T16:50:18.000-06:00",
    });
    expect(parseCancelAccessInstant("2026-11-11T16:50:18-06:00")).toBe(
      parseCancelAccessInstant("2026-11-11T22:50:18Z"),
    );
    expect(classifyCancelAccessUntil(new Date(NOW + 1).toISOString(), NOW).state).toBe("future");
  });

  test("equality, expiry, null, and invalid instants are not protected", () => {
    expect(classifyCancelAccessUntil(EQUAL, NOW)).toEqual({ state: "equal", until: EQUAL });
    expect(classifyCancelAccessUntil("2026-11-08T09:39:00.000-06:00", NOW).state).toBe("equal");
    expect(classifyCancelAccessUntil(EXPIRED, NOW).state).toBe("expired");
    expect(classifyCancelAccessUntil(new Date(NOW - 1).toISOString(), NOW).state).toBe("expired");
    expect(classifyCancelAccessUntil(null, NOW)).toEqual({ state: "absent" });
    expect(classifyCancelAccessUntil(undefined, NOW)).toEqual({ state: "absent" });
    expect(classifyCancelAccessUntil("", NOW)).toEqual({ state: "absent" });
    expect(classifyCancelAccessUntil("   ", NOW)).toEqual({ state: "absent" });
    for (const invalid of [
      "not-a-date",
      "2026-11-11",
      "2026-11-11T22:50:18",
      "2026-13-01T00:00:00Z",
      "2026-02-31T00:00:00Z",
      "2026-11-11T22:50:18.000+99:00",
      1_763_000_000_000,
      true,
      { until: FUTURE },
    ]) {
      expect(classifyCancelAccessUntil(invalid, NOW).state).toBe("invalid");
    }
  });
});

describe("platform-admin override boundary", () => {
  test("the allowlist is the platform-admin emails, not a new role", () => {
    const migration = readFileSync(
      "supabase/migrations/20261109053000_platform_admin_allowlist.sql",
      "utf8",
    );
    const adminAuth = readFileSync("supabase/functions/_shared/admin-auth.ts", "utf8");
    const allowlist = readFileSync("supabase/functions/_shared/platformAdmins.ts", "utf8");
    expect(migration).toContain("LANGUAGE sql");
    expect(migration).toContain("STABLE");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = public");
    expect(migration).toContain("'andrew@dna-media.net'");
    expect(migration).toContain("'team@yoursoftwareonboarding.com'");
    expect(migration).toContain("public.is_platform_admin()");
    expect(adminAuth).toContain("isPlatformAdminEmail");
    expect(allowlist).toContain(`"${PLATFORM_ADMIN_EMAIL}"`);
    expect(allowlist).toContain('"team@yoursoftwareonboarding.com"');
    expect(isExistingPlatformAdminEmail("Andrew@DNA-MEDIA.NET")).toBe(true);
    expect(isExistingPlatformAdminEmail(`  ${ADMIN}  `)).toBe(true);
    expect(isExistingPlatformAdminEmail("Team@YourSoftwareOnboarding.com")).toBe(true);
    expect(isExistingPlatformAdminEmail("team-admin@agency.example")).toBe(false);
    expect(isExistingPlatformAdminEmail("andrew@dna-media.net.evil.example")).toBe(false);
    expect(isExistingPlatformAdminEmail("rendersgallery0@gmail.com")).toBe(false);
    expect(isExistingPlatformAdminEmail(null)).toBe(false);
  });

  test("force is ignored unless the Auth session email is that admin", () => {
    expect(suspendOverrideAllowed(true, ADMIN)).toBe(true);
    expect(suspendOverrideAllowed(true, "Andrew@DNA-MEDIA.NET")).toBe(true);
    expect(suspendOverrideAllowed(true, "team@yoursoftwareonboarding.com")).toBe(true);
    expect(suspendOverrideAllowed(true, "Team@YourSoftwareOnboarding.com")).toBe(true);
    expect(suspendOverrideAllowed(true, null)).toBe(false);
    expect(suspendOverrideAllowed(true, OWNER)).toBe(false);
    expect(suspendOverrideAllowed("true", ADMIN)).toBe(false);
    expect(suspendOverrideAllowed(1, ADMIN)).toBe(false);
    expect(suspendOverrideAllowed(false, ADMIN)).toBe(false);
    expect(suspendOverrideAllowed(undefined, ADMIN)).toBe(false);
  });

  test("a bearer token is resolved with getUser, and a body email is not a session", async () => {
    const req = new Request("https://example.test/", {
      headers: { Authorization: "Bearer admin-token" },
    });
    expect(readBearerToken(req)).toBe("admin-token");
    expect(readBearerToken(new Request("https://example.test/"))).toBe(null);
    expect(readBearerToken(new Request("https://example.test/", { headers: { Authorization: "Bearer " } }))).toBe(null);
    expect(sessionEmailFromAuthUser({ email: ADMIN }, true)).toBe(null);
    expect(sessionEmailFromAuthUser(null, false)).toBe(null);
    expect(sessionEmailFromAuthUser({ email: "" }, false)).toBe(null);

    const lookedUp: string[] = [];
    const email = await resolveSessionEmail(req, async (token) => {
      lookedUp.push(token);
      return { user: { email: ADMIN }, error: false };
    });
    expect(email).toBe(ADMIN);
    expect(lookedUp).toEqual(["admin-token"]);
    expect(await resolveSessionEmail(req, async () => {
      throw new Error("auth down");
    })).toBe(null);
    expect(await resolveSessionEmail(new Request("https://example.test/"), async () => {
      throw new Error("should not be called");
    })).toBe(null);
  });
});

describe("suspend-user-access paid-through guard", () => {
  test("a future window skips the suspension RPC and the cancellation webhook", async () => {
    const { calls, deps } = harness({ found: { row: row({ cancel_access_until: FUTURE }) } });
    const result = await post({ user_email: OWNER }, deps);
    expect(result.status).toBe(200);
    expect(result.payload).toEqual({
      success: true,
      skipped: true,
      reason: "cancel_access_until_active",
      cancel_access_until: FUTURE,
    });
    expect(calls.suspend).toEqual([]);
    expect(calls.webhooks).toEqual([]);
    expect(calls.tokens).toEqual([]);
  });

  test("equality, expiry, null, and invalid deadlines still suspend once", async () => {
    for (const cancelAccessUntil of [EQUAL, EXPIRED, null, "", "not-a-date", "2026-11-11", 1_763_000_000_000]) {
      const { calls, deps } = harness({ found: { row: row({ cancel_access_until: cancelAccessUntil }) } });
      const result = await post({ user_email: OWNER }, deps);
      expect(result.status).toBe(200);
      expect(result.payload).toEqual({ success: true, message: "User access suspended successfully" });
      expect(calls.suspend).toEqual([OWNER]);
      expect(calls.webhooks).toEqual([OWNER]);
      expect(calls.tokens).toEqual([]);
    }
  });

  test("one millisecond on either side of now follows the strict future window", async () => {
    const justAhead = new Date(NOW + 1).toISOString();
    const justPast = new Date(NOW - 1).toISOString();
    const ahead = harness({ found: { row: row({ cancel_access_until: justAhead }) } });
    expect((await post({ user_email: OWNER }, ahead.deps)).payload.reason).toBe("cancel_access_until_active");
    expect(ahead.calls.suspend).toEqual([]);
    const past = harness({ found: { row: row({ cancel_access_until: justPast }) } });
    expect((await post({ user_email: OWNER }, past.deps)).status).toBe(200);
    expect(past.calls.suspend).toEqual([OWNER]);
    expect(past.calls.webhooks).toEqual([OWNER]);
  });

  test("billing state does not open or close the window", async () => {
    const kept = harness({
      found: { row: row({ billing_state: "PAST_DUE", cancel_access_until: FUTURE }) },
    });
    expect((await post({ user_email: OWNER }, kept.deps)).payload.reason).toBe("cancel_access_until_active");
    expect(kept.calls.suspend).toEqual([]);
    const open = harness({
      found: { row: row({ billing_state: "PAST_DUE", cancel_access_until: null, approval: "YES" }) },
    });
    expect((await post({ user_email: OWNER }, open.deps)).payload.message).toBe("User access suspended successfully");
    expect(open.calls.webhooks).toEqual([OWNER]);
  });

  test("an already suspended account stays a no-op, including inside a future window", async () => {
    const { calls, deps } = harness({
      found: { row: row({ approval: "NO", cancel_access_until: FUTURE }) },
    });
    const result = await post({ user_email: OWNER, force: true }, deps, "Bearer admin-token");
    expect(result.payload).toEqual({
      success: true,
      message: "User already suspended, no action taken",
      skipped: true,
    });
    expect(calls.suspend).toEqual([]);
    expect(calls.webhooks).toEqual([]);
    expect(calls.tokens).toEqual([]);
  });

  test("force true from an unauthenticated or non-admin caller does not override the window", async () => {
    const users = new Map<string, UserResult>([
      ["member-token", { user: { email: OWNER }, error: false }],
      ["team-admin-token", { user: { email: "team-admin@agency.example" }, error: false }],
      ["error-token", { user: { email: ADMIN }, error: true }],
      ["blank-token", { user: { email: "" }, error: false }],
    ]);
    const attempts: Array<{ authorization?: string; body: Record<string, unknown> }> = [
      { body: { user_email: OWNER, force: true, webhook_secret: SECRET, email: ADMIN, admin: true, session_email: ADMIN } },
      { authorization: "Bearer unknown-token", body: { user_email: OWNER, force: true, webhook_secret: SECRET } },
      { authorization: "Bearer member-token", body: { user_email: OWNER, force: true, webhook_secret: SECRET, email: ADMIN } },
      { authorization: "Bearer team-admin-token", body: { user_email: OWNER, force: true, webhook_secret: SECRET } },
      { authorization: "Bearer error-token", body: { user_email: OWNER, force: true, webhook_secret: SECRET } },
      { authorization: "Bearer blank-token", body: { user_email: OWNER, force: true, webhook_secret: SECRET } },
      { authorization: `Bearer ${SECRET}`, body: { user_email: OWNER, force: true, webhook_secret: SECRET } },
    ];
    for (const attempt of attempts) {
      const { calls, deps } = harness({
        users,
        secret: SECRET,
        found: { row: row({ cancel_access_until: FUTURE }) },
      });
      const result = await post(attempt.body, deps, attempt.authorization);
      expect(result.status).toBe(200);
      expect(result.payload).toMatchObject({ skipped: true, reason: "cancel_access_until_active" });
      expect(calls.suspend).toEqual([]);
      expect(calls.webhooks).toEqual([]);
    }
  });

  test("a webhook secret match is not an admin session", async () => {
    const { calls, deps } = harness({
      secret: SECRET,
      found: { row: row({ cancel_access_until: FUTURE }) },
    });
    const result = await post({ user_email: OWNER, force: true, webhook_secret: SECRET }, deps);
    expect(result.payload.reason).toBe("cancel_access_until_active");
    expect(calls.tokens).toEqual([]);
    expect(calls.suspend).toEqual([]);
  });

  test("string or numeric force does not override even with the admin session", async () => {
    const users = new Map<string, UserResult>([
      ["admin-token", { user: { email: "Andrew@DNA-MEDIA.NET" }, error: false }],
    ]);
    for (const force of ["true", 1, false]) {
      const { calls, deps } = harness({
        users,
        found: { row: row({ cancel_access_until: FUTURE }) },
      });
      const result = await post({ user_email: OWNER, force }, deps, "Bearer admin-token");
      expect(result.payload.reason).toBe("cancel_access_until_active");
      expect(calls.tokens).toEqual([]);
      expect(calls.suspend).toEqual([]);
    }
  });

  test("the platform-admin session can force suspension inside the window", async () => {
    const users = new Map<string, UserResult>([
      ["admin-token", { user: { email: "Andrew@DNA-MEDIA.NET" }, error: false }],
    ]);
    const { calls, deps } = harness({
      users,
      secret: SECRET,
      found: { row: row({ cancel_access_until: FUTURE, billing_state: "ACTIVE" }) },
    });
    const result = await post(
      { user_email: OWNER, force: true, webhook_secret: SECRET },
      deps,
      "Bearer admin-token",
    );
    expect(result.status).toBe(200);
    expect(result.payload).toEqual({ success: true, message: "User access suspended successfully" });
    expect(calls.tokens).toEqual(["admin-token"]);
    expect(calls.suspend).toEqual([OWNER]);
    expect(calls.webhooks).toEqual([OWNER]);
  });

  test("the admin session does not skip the webhook secret or suspend without force", async () => {
    const users = new Map<string, UserResult>([
      ["admin-token", { user: { email: ADMIN }, error: false }],
    ]);
    const rejected = harness({
      users,
      secret: SECRET,
      found: { row: row({ cancel_access_until: FUTURE }) },
    });
    const denied = await post({ user_email: OWNER, force: true }, rejected.deps, "Bearer admin-token");
    expect(denied.status).toBe(401);
    expect(denied.payload).toEqual({ error: "Unauthorized" });
    expect(rejected.calls.find).toEqual([]);
    expect(rejected.calls.tokens).toEqual([]);
    expect(rejected.calls.suspend).toEqual([]);

    const unforced = harness({
      users,
      secret: SECRET,
      found: { row: row({ cancel_access_until: FUTURE }) },
    });
    const skipped = await post(
      { user_email: OWNER, webhook_secret: SECRET },
      unforced.deps,
      "Bearer admin-token",
    );
    expect(skipped.payload.reason).toBe("cancel_access_until_active");
    expect(unforced.calls.tokens).toEqual([]);
    expect(unforced.calls.suspend).toEqual([]);
  });

  test("outside the window a non-admin caller still suspends, and a missing user does not", async () => {
    const users = new Map<string, UserResult>([
      ["member-token", { user: { email: OWNER }, error: false }],
    ]);
    const open = harness({
      users,
      found: { row: row({ approval: "YES", cancel_access_until: null }) },
    });
    const suspended = await post({ user_email: OWNER, force: true }, open.deps, "Bearer member-token");
    expect(suspended.payload.message).toBe("User access suspended successfully");
    expect(open.calls.tokens).toEqual([]);
    expect(open.calls.suspend).toEqual([OWNER]);
    expect(open.calls.webhooks).toEqual([OWNER]);

    const missing = harness({ found: { row: null } });
    const notFound = await post({ user_email: OWNER }, missing.deps);
    expect(notFound.status).toBe(404);
    expect(notFound.payload).toEqual({ success: false, message: "User not found" });
    expect(missing.calls.suspend).toEqual([]);

    const failed = harness({ found: { row: null, error: "db down" } });
    expect((await post({ user_email: OWNER }, failed.deps)).status).toBe(500);
    expect(failed.calls.suspend).toEqual([]);

    const rpcFailed = harness({ suspended: { suspended: false, error: "rpc down" } });
    const rpc = await post({ user_email: OWNER }, rpcFailed.deps);
    expect(rpc.status).toBe(500);
    expect(rpcFailed.calls.webhooks).toEqual([]);

    const rpcMiss = harness({ suspended: { suspended: false } });
    expect((await post({ user_email: OWNER }, rpcMiss.deps)).status).toBe(404);
    expect(rpcMiss.calls.webhooks).toEqual([]);

    const invalid = harness();
    expect((await post({ user_email: "" }, invalid.deps)).status).toBe(400);
    expect(invalid.calls.find).toEqual([]);
  });

  test("a cancellation webhook failure still reports the suspension", async () => {
    const { deps, calls } = harness({
      post: async () => {
        throw new Error("leadconnector down");
      },
    });
    const result = await post({ user_email: OWNER }, deps);
    expect(result.status).toBe(200);
    expect(result.payload.message).toBe("User access suspended successfully");
    expect(calls.suspend).toEqual([OWNER]);
  });

  test("the decision helper matches the handler for a future window and an admin override", () => {
    expect(decideSuspendAccess({
      approval: "YES",
      cancelAccessUntil: FUTURE,
      nowMs: NOW,
      force: true,
      sessionEmail: OWNER,
    })).toEqual({ action: "skip_paid_through", cancelAccessUntil: FUTURE });
    expect(decideSuspendAccess({
      approval: "YES",
      cancelAccessUntil: FUTURE,
      nowMs: NOW,
      force: true,
      sessionEmail: ADMIN,
    })).toEqual({ action: "suspend" });
    expect(decideSuspendAccess({
      approval: "NO",
      cancelAccessUntil: FUTURE,
      nowMs: NOW,
      force: true,
      sessionEmail: ADMIN,
    })).toEqual({ action: "already_suspended" });
  });
});

describe("suspend-user-access wiring", () => {
  test("the deployed function reads the deadline and the Auth user, and keeps the existing suspension RPC", () => {
    const index = readFileSync("supabase/functions/suspend-user-access/index.ts", "utf8");
    const grace = readFileSync("supabase/functions/expire-payment-grace/index.ts", "utf8");
    const graceSql = readFileSync(
      "supabase/migrations/20260924154425_273b3ca2-4296-4cd5-a143-1f2a3384cad9.sql",
      "utf8",
    );
    expect(index).toContain('select("approval, billing_state, cancel_access_until")');
    expect(index).toContain("auth.getUser(token)");
    expect(index).toContain('rpc("suspend_user_access"');
    expect(index).toContain("CANCELLATION_WEBHOOK_URL");
    expect(index).not.toContain("mark_payment_delinquent");
    expect(index).not.toContain("record.force");
    expect(index).not.toContain("body.force");
    expect(CANCELLATION_WEBHOOK_URL).toBe(
      "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8269ec40-aa2b-4068-b3b7-4cc6404d8ff8",
    );
    expect(grace).toContain(CANCELLATION_WEBHOOK_URL);
    expect(graceSql).toContain("cancel_access_until < now()");
  });
});
