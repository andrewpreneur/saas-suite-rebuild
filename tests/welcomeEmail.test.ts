import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  WELCOME_EMAIL_CUTOVER_ISO,
  WELCOME_LOGIN_REDIRECT,
  WELCOME_MAX_ATTEMPTS,
  accountWelcomeCopy,
  buildAccountWelcomePayload,
  candidateFromRow,
  deliverWelcomeBatch,
  isWelcomeForSession,
  pendingWelcomeDecision,
  postJsonWebhook,
  resolveWelcomeLoginLink,
  welcomeRetryPlan,
  type LinkAdmin,
  type WelcomeUserRow,
  type WelcomeWebhookBody,
} from "../supabase/functions/_shared/welcome-email";
import {
  commitSaasUserWrite,
  isStatementTimeout,
  isUniqueViolation,
  purchaseExistingUpdate,
  purchaseInsertRow,
  trialAccessUpdate,
  writeUntilRow,
} from "../supabase/functions/_shared/saas-user-write";

const CUTOVER_MS = Date.parse(WELCOME_EMAIL_CUTOVER_ISO);
const AFTER = CUTOVER_MS + 30 * 60 * 1000;
const QUIET_LATER = CUTOVER_MS + 30 * 60 * 1000;

function row(overrides: Partial<WelcomeUserRow> = {}): WelcomeUserRow {
  return {
    id: 1,
    email: "cee@agency.com",
    full_name: "Cee Example",
    plan: "ADVANCED",
    source: "stripe_webhook",
    agency_name: "Cee Agency",
    agency_id: "cee-agency",
    agency_id_basic: "cee-agency",
    agency_id_advanced: null,
    agency_id_elite: null,
    created_at: new Date(CUTOVER_MS + 60 * 1000).toISOString(),
    welcome_ai_email_sent_at: null,
    hub_welcome_email_sent_at: null,
    hub_welcome_email_queued_at: null,
    welcome_email_attempts: 0,
    welcome_email_next_attempt_at: null,
    welcome_email_claimed_at: null,
    welcome_email_force: false,
    ...overrides,
  };
}

describe("pending welcome selection", () => {
  test("sends a post-cutover account once the quiet window has passed", () => {
    const decision = pendingWelcomeDecision(candidateFromRow(row()), QUIET_LATER);
    expect(decision).toEqual({ send: true });
  });

  test("does not email the backlog from before the cutover", () => {
    const decision = pendingWelcomeDecision(
      candidateFromRow(row({ created_at: new Date(CUTOVER_MS - 86_400_000).toISOString() })),
      AFTER,
    );
    expect(decision).toEqual({ send: false, reason: "before_cutover" });
  });

  test("force queues a backlog row, including internal and admin_granted", () => {
    const created = new Date(CUTOVER_MS - 86_400_000).toISOString();
    expect(pendingWelcomeDecision(candidateFromRow(row({ created_at: created, welcome_email_force: true })), AFTER).send).toBe(true);
    expect(pendingWelcomeDecision(candidateFromRow(row({ source: "internal" })), QUIET_LATER)).toEqual({ send: false, reason: "excluded_source" });
    expect(pendingWelcomeDecision(candidateFromRow(row({ source: "admin_granted" })), QUIET_LATER)).toEqual({ send: false, reason: "excluded_source" });
    expect(pendingWelcomeDecision(candidateFromRow(row({ source: "Admin_Granted", welcome_email_force: true, created_at: created })), AFTER).send).toBe(true);
  });

  test("waits out a fresh signup, a live claim, and a backoff", () => {
    expect(pendingWelcomeDecision(candidateFromRow(row({ created_at: new Date(AFTER).toISOString() })), AFTER)).toEqual({ send: false, reason: "too_new" });
    expect(pendingWelcomeDecision(candidateFromRow(row({ welcome_email_claimed_at: new Date(AFTER - 60_000).toISOString() })), AFTER)).toEqual({ send: false, reason: "claimed" });
    expect(pendingWelcomeDecision(candidateFromRow(row({
      welcome_email_attempts: 1,
      welcome_email_next_attempt_at: new Date(AFTER + 60_000).toISOString(),
    })), AFTER)).toEqual({ send: false, reason: "waiting_backoff" });
    expect(pendingWelcomeDecision(candidateFromRow(row({ welcome_email_attempts: WELCOME_MAX_ATTEMPTS })), AFTER)).toEqual({ send: false, reason: "attempts_exhausted" });
    expect(pendingWelcomeDecision(candidateFromRow(row({ welcome_ai_email_sent_at: new Date(AFTER).toISOString() })), AFTER)).toEqual({ send: false, reason: "already_sent" });
    expect(pendingWelcomeDecision(candidateFromRow(row({ hub_welcome_email_queued_at: new Date(AFTER).toISOString() })), AFTER)).toEqual({ send: false, reason: "hub_welcome" });
  });

  test("a stale claim can be taken again", () => {
    const decision = pendingWelcomeDecision(candidateFromRow(row({
      welcome_email_claimed_at: new Date(AFTER - 20 * 60 * 1000).toISOString(),
    })), AFTER);
    expect(decision.send).toBe(true);
  });
});

describe("first-session welcome window", () => {
  const now = Date.parse("2026-10-25T12:00:00.000Z");

  test("a first login weeks after signup is still a welcome", () => {
    expect(isWelcomeForSession({
      welcomeSentAt: null,
      loginCount: 1,
      lastLoginAt: "2026-10-25T11:00:00.000Z",
      earliestLoginAt: "2026-10-25T11:00:00.000Z",
      sessionStartedAt: "2026-10-25T11:00:00.000Z",
      nowMs: now,
    })).toBe(true);
  });

  test("account age no longer blocks that first login", () => {
    expect(isWelcomeForSession({
      welcomeSentAt: null,
      loginCount: 0,
      lastLoginAt: null,
      earliestLoginAt: null,
      sessionStartedAt: "2026-10-25T11:50:00.000Z",
      nowMs: now,
    })).toBe(true);
    // A zero login count with a signup-time last_login_at is still a first session.
    expect(isWelcomeForSession({
      welcomeSentAt: null,
      loginCount: 0,
      lastLoginAt: "2026-08-01T00:00:00.000Z",
      earliestLoginAt: null,
      sessionStartedAt: "2026-10-25T11:50:00.000Z",
      nowMs: now,
    })).toBe(true);
  });

  test("a later login stays on the returning path", () => {
    expect(isWelcomeForSession({
      welcomeSentAt: null,
      loginCount: 4,
      lastLoginAt: "2026-10-25T11:00:00.000Z",
      earliestLoginAt: "2026-08-01T00:00:00.000Z",
      sessionStartedAt: "2026-10-25T11:00:00.000Z",
      nowMs: now,
    })).toBe(false);
    expect(isWelcomeForSession({
      welcomeSentAt: "2026-10-01T00:00:00.000Z",
      loginCount: 1,
      lastLoginAt: "2026-10-25T11:00:00.000Z",
      earliestLoginAt: "2026-10-25T11:00:00.000Z",
      sessionStartedAt: "2026-10-25T11:00:00.000Z",
      nowMs: now,
    })).toBe(false);
  });

  test("the first login itself expires after 48 hours", () => {
    expect(isWelcomeForSession({
      welcomeSentAt: null,
      loginCount: 1,
      lastLoginAt: "2026-10-20T00:00:00.000Z",
      earliestLoginAt: "2026-10-20T00:00:00.000Z",
      sessionStartedAt: "2026-10-25T11:00:00.000Z",
      nowMs: now,
    })).toBe(false);
  });
});

describe("webhook acceptance", () => {
  test("only 2xx counts as sent, and the test never calls a live host", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const target = String(url);
      calls.push(target);
      expect(target).toBe("https://example.test/welcome");
      expect(target).not.toContain("leadconnectorhq");
      expect(init?.method).toBe("POST");
      return new Response("accepted", { status: 204 });
    };
    const ok = await postJsonWebhook(fetchImpl, "https://example.test/welcome", { email: "cee@agency.com" });
    expect(ok).toEqual({ ok: true, status: 204, error: null });

    const failed = await postJsonWebhook(async () => new Response("nope", { status: 502 }), "https://example.test/welcome", {});
    expect(failed.ok).toBe(false);
    expect(failed.status).toBe(502);
    expect(failed.error).toContain("nope");

    const thrown = await postJsonWebhook(async () => {
      throw new Error("socket closed");
    }, "https://example.test/welcome", {});
    expect(thrown).toEqual({ ok: false, status: null, error: "socket closed" });
    expect(calls).toEqual(["https://example.test/welcome"]);
  });
});

describe("set-password link", () => {
  function admin(handlers: {
    invite?: () => { link?: string; error?: string };
    recovery?: () => { link?: string; error?: string };
  }): LinkAdmin & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      generateLink: async (args) => {
        calls.push(args.type);
        expect(args.options.redirectTo).toBe(WELCOME_LOGIN_REDIRECT);
        expect(args.email).toBe("cee@agency.com");
        const result = args.type === "invite" ? handlers.invite?.() : handlers.recovery?.();
        return {
          data: result?.link ? { properties: { action_link: result.link } } : null,
          error: result?.error ? { message: result.error } : null,
        };
      },
    };
  }

  test("an existing auth user does not get a new link", async () => {
    const fake = admin({ invite: () => ({ link: "https://example.test/should-not-issue" }) });
    const result = await resolveWelcomeLoginLink(fake, "Cee@agency.com", true);
    expect(result).toEqual({ ok: true, url: null });
    expect(fake.calls).toEqual([]);
  });

  test("a user with no auth login gets a recovery link, not a live email", async () => {
    const fake = admin({
      invite: () => ({ link: "https://example.test/invite" }),
      recovery: () => ({ link: "https://example.test/recovery?type=recovery" }),
    });
    const result = await resolveWelcomeLoginLink(fake, "cee@agency.com", false);
    expect(result).toEqual({ ok: true, url: "https://example.test/recovery?type=recovery" });
    expect(fake.calls).toEqual(["invite", "recovery"]);
    expect(String(result.ok && result.url)).not.toContain("leadconnector");
  });

  test("invite that finds an existing account does not invent a second link", async () => {
    const fake = admin({ invite: () => ({ error: "A user with this email address has already been registered" }) });
    const result = await resolveWelcomeLoginLink(fake, "cee@agency.com", false);
    expect(result).toEqual({ ok: true, url: null });
  });
});

describe("delivery", () => {
  const calls = () => {
    const posts: WelcomeWebhookBody[] = [];
    const sent: string[] = [];
    const retried: string[] = [];
    const terminal: string[] = [];
    return {
      posts,
      sent,
      retried,
      terminal,
      deps: {
        nowMs: QUIET_LATER,
        dryRun: false,
        claim: async () => true,
        authStatus: async () => "none" as const,
        issueLink: async () => ({ ok: true as const, url: "https://example.test/set-password" }),
        hubUrl: async () => "https://yoursoftwareonboarding.com/v2/cee-agency",
        post: async (payload: WelcomeWebhookBody) => {
          posts.push(payload);
          expect(JSON.stringify(payload)).not.toContain("leadconnectorhq");
          return { ok: true, status: 200, error: null };
        },
        markSent: async (user: WelcomeUserRow) => {
          sent.push(String(user.email));
          return true;
        },
        markRetry: async (user: WelcomeUserRow) => {
          retried.push(String(user.email));
        },
        markTerminal: async (user: WelcomeUserRow) => {
          terminal.push(String(user.email));
        },
      },
    };
  };

  test("a 2xx stamps sent and includes the set-password link", async () => {
    const harness = calls();
    const results = await deliverWelcomeBatch({ rows: [row()], ...harness.deps });
    expect(results).toEqual([{ email: "cee@agency.com", status: "sent", reason: null }]);
    expect(harness.sent).toEqual(["cee@agency.com"]);
    expect(harness.retried).toEqual([]);
    expect(harness.posts[0].set_password_url).toBe("https://example.test/set-password");
    expect(harness.posts[0].has_auth_login).toBe(false);
    expect(harness.posts[0].email_type).toBe("welcome");
    expect(harness.posts[0].body).toContain("https://example.test/set-password");
    expect(harness.posts[0].body).toContain("https://yoursoftwareonboarding.com/v2/cee-agency");
  });

  test("a non-2xx does not stamp and schedules a retry", async () => {
    const harness = calls();
    harness.deps.post = async () => ({ ok: false, status: 500, error: "down" });
    const results = await deliverWelcomeBatch({ rows: [row()], ...harness.deps });
    expect(results[0].status).toBe("failed");
    expect(results[0].reason).toContain("webhook_http_500");
    expect(harness.sent).toEqual([]);
    expect(harness.retried).toEqual(["cee@agency.com"]);
  });

  test("dry run and a lost claim do not post", async () => {
    const harness = calls();
    const dry = await deliverWelcomeBatch({ rows: [row()], ...harness.deps, dryRun: true });
    expect(dry[0].status).toBe("dry_run");
    expect(harness.posts).toEqual([]);
    const lost = await deliverWelcomeBatch({ rows: [row()], ...harness.deps, claim: async () => false });
    expect(lost[0]).toEqual({ email: "cee@agency.com", status: "skipped", reason: "claimed" });
    expect(harness.posts).toEqual([]);
  });

  test("a signed-in user is not issued a set-password link", async () => {
    const harness = calls();
    let issued = 0;
    harness.deps.authStatus = async () => "auth";
    harness.deps.issueLink = async () => {
      issued += 1;
      return { ok: true, url: "https://example.test/nope" };
    };
    const results = await deliverWelcomeBatch({ rows: [row()], ...harness.deps });
    expect(results[0].status).toBe("sent");
    expect(issued).toBe(0);
    expect(harness.posts[0].set_password_url).toBe("");
    expect(harness.posts[0].has_auth_login).toBe(true);
    expect(harness.posts[0].body).not.toContain("sets your password");
  });

  test("backoff grows and then stops", () => {
    const now = 1_000_000;
    expect(welcomeRetryPlan(0, now).attempts).toBe(1);
    expect(welcomeRetryPlan(0, now).retryAtMs - now).toBe(5 * 60 * 1000);
    expect(welcomeRetryPlan(1, now).retryAtMs - now).toBe(30 * 60 * 1000);
    const last = welcomeRetryPlan(4, now);
    expect(last.exhausted).toBe(true);
    expect(last.attempts).toBe(WELCOME_MAX_ATTEMPTS);
  });

  test("the no-agency copy asks for a name and still carries the link", () => {
    const copy = accountWelcomeCopy({
      firstName: "Phil",
      hubUrl: null,
      setPasswordUrl: "https://example.test/set-password",
    });
    expect(copy.subject).toContain("one thing");
    expect(copy.body).toContain("What's your agency name?");
    expect(copy.body).toContain("https://example.test/set-password");
    expect(copy.body).not.toContain("yoursoftwareonboarding.com");
    const payload = buildAccountWelcomePayload({
      email: "phil@agency.com",
      fullName: "Phil",
      plan: "BASIC",
      hubUrl: null,
      setPasswordUrl: "https://example.test/set-password",
      hasAuthLogin: false,
    });
    expect(payload.plan).toBe("BASIC");
    expect(payload.reason).toBe("account_created");
  });
});

describe("stripe user write", () => {
  const sleep = async () => {};

  test("insert success does not adopt", async () => {
    let adopted = 0;
    const result = await commitSaasUserWrite({
      insert: async () => ({ data: { email: "a@b.com" }, error: null }),
      adopt: async () => {
        adopted += 1;
        return { data: null, error: null };
      },
      sleep,
    });
    expect(result).toEqual({ ok: true, created: true, row: { email: "a@b.com" } });
    expect(adopted).toBe(0);
  });

  test("unique violation updates the row that won the race", async () => {
    const result = await commitSaasUserWrite({
      insert: async () => ({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }),
      adopt: async () => ({ data: { email: "a@b.com", plan: "ADVANCED" }, error: null }),
      sleep,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.row).toEqual({ email: "a@b.com", plan: "ADVANCED" });
    }
  });

  test("statement timeout is retried, then reported", async () => {
    let tries = 0;
    const result = await commitSaasUserWrite({
      insert: async () => {
        tries += 1;
        if (tries < 3) return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
        return { data: { email: "a@b.com" }, error: null };
      },
      adopt: async () => ({ data: null, error: null }),
      sleep,
    });
    expect(tries).toBe(3);
    expect(result.ok).toBe(true);

    const exhausted = await commitSaasUserWrite({
      attempts: 2,
      insert: async () => ({ data: null, error: { code: "57014", message: "statement timeout" } }),
      adopt: async () => ({ data: null, error: null }),
      sleep,
    });
    expect(exhausted).toMatchObject({ ok: false, reason: "timeout" });
  });

  test("a unique miss does not pretend the trial row exists", async () => {
    const result = await commitSaasUserWrite({
      insert: async () => ({ data: null, error: { message: "duplicate key" } }),
      adopt: async () => ({ data: null, error: null }),
      sleep,
    });
    expect(result).toMatchObject({ ok: false, reason: "conflict_missing" });
    expect(isUniqueViolation({ message: "duplicate key value" })).toBe(true);
    expect(isStatementTimeout({ code: "57014" })).toBe(true);
  });

  test("trial fields are applied only after the row exists", async () => {
    const now = "2026-10-22T03:00:00.000Z";
    expect(trialAccessUpdate({ trial_source: "webinar_registrant_14day", trial_days: "14" }, now)).toMatchObject({
      plan: "ADVANCED",
      trial_length: 14,
      trial_start_date: now,
      approval: "YES",
    });
    expect(trialAccessUpdate({ trial_source: "public_copilot_3day", plan: "basic", trial_days: "3" }, now)?.plan).toBe("BASIC");
    expect(trialAccessUpdate({}, now)).toBeNull();

    let writes = 0;
    const missing = await writeUntilRow(async () => {
      writes += 1;
      return { data: null, error: null };
    }, { sleep });
    expect(missing).toMatchObject({ ok: false, reason: "missing_row" });
    expect(writes).toBe(1);

    const ready = await writeUntilRow(async () => ({ data: { email: "a@b.com", trial_source: "webinar_registrant_14day" }, error: null }), { sleep });
    expect(ready.ok).toBe(true);
  });

  test("the purchase update keeps first-touch fields and does not reset onboarding answers", () => {
    const patch = purchaseExistingUpdate({
      dbPlan: "BASIC",
      maxUsers: 5,
      resolvedName: "Phil",
      isPremiumSupport: false,
      nowIso: "2026-10-22T03:00:00.000Z",
      existing: { full_name: "Philip", fbclid: "kept", agency_id: "already", utm_source: "facebook" },
      resolvedFbclid: "new",
      resolvedFbc: "fbc",
      resolvedFbp: "",
      attribution: { utm_source: "google", utm_medium: "cpc" },
      checkoutPage: "/special",
      generatedAgencyId: "phil",
      agencySlugSource: "phil",
    });
    expect(patch.fbclid).toBeUndefined();
    expect(patch.utm_source).toBeUndefined();
    expect(patch.utm_medium).toBe("cpc");
    expect(patch.agency_id).toBeUndefined();
    expect(patch.initial_questions_completed).toBeUndefined();
    expect(patch.plan).toBe("BASIC");
    expect(patch.checkout_page).toBe("/special");
    expect(patch.fbc).toBe("fbc");

    const inserted = purchaseInsertRow({
      email: "phil@agency.com",
      dbPlan: "ADVANCED",
      maxUsers: 10000,
      resolvedName: "Phil",
      isPremiumSupport: true,
      nowIso: "2026-10-22T03:00:00.000Z",
      agencySlugSource: "phil",
      generatedAgencyId: "phil",
      resolvedFbclid: "click",
      attribution: { utm_source: "facebook" },
      checkoutPage: "",
    });
    expect(inserted.email).toBe("phil@agency.com");
    expect(inserted.initial_questions_completed).toBe(false);
    expect(inserted.premium_support).toBe(true);
    expect(inserted.fbclid).toBe("click");
  });
});

describe("welcome migration", () => {
  const sql = readFileSync("supabase/migrations/20261022021500_welcome_email_queue.sql", "utf8");

  test("is additive, after the cutover timestamp, and does not email anyone", () => {
    expect(sql.startsWith("--")).toBe(true);
    expect(sql).toContain("2026-10-22 02:00:00+00");
    expect(sql).toContain("welcome_email_force boolean NOT NULL DEFAULT false");
    expect(sql).toContain("send-pending-welcome");
    expect(sql).not.toMatch(/UPDATE\s+public\.saas_suite_users\s+SET\s+welcome_ai_email_sent_at/i);
    const executable = sql.replace(/--.*$/gm, "");
    expect(executable).not.toMatch(/UPDATE\s+public\.saas_suite_users/i);
  });
});

describe("welcome claim", () => {
  test("only the first conditional update claims the row", async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE saas_suite_users (
        id int PRIMARY KEY,
        email text,
        welcome_ai_email_sent_at timestamptz,
        welcome_email_claimed_at timestamptz
      );
      INSERT INTO saas_suite_users (id, email) VALUES (1, 'cee@agency.com');
    `);
    const claim = (seen: string | null) => db.query(
      `UPDATE saas_suite_users
       SET welcome_email_claimed_at = timestamptz '2026-10-22 03:00:00+00'
       WHERE id = 1
         AND welcome_ai_email_sent_at IS NULL
         AND welcome_email_claimed_at IS NOT DISTINCT FROM $1
       RETURNING id`,
      [seen],
    );
    const first = await claim(null);
    const second = await claim(null);
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
    await db.close();
  });
});
