import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import {
  cancelDedupeKey,
  immediateClaimKeyFromPrior,
  planSubscriptionCancel,
  recordSubscriptionCanceled,
} from "../supabase/functions/_shared/subscription-cancel-log.ts";

const dedupeMigration = readFileSync(
  new URL("../supabase/migrations/20261024181245_subscription_canceled_dedupe.sql", import.meta.url),
  "utf8",
);
const indexMigration = readFileSync(
  new URL("../supabase/migrations/20261024181246_subscription_canceled_dedupe_index.sql", import.meta.url),
  "utf8",
);
const delinquencyMigration = readFileSync(
  new URL("../supabase/migrations/20261026122542_cancel_claim_and_delinquency_timeout.sql", import.meta.url),
  "utf8",
);

const duplicateKey = "sub_dup:2026-11-16T14:30:07.000Z:immediate";

function duplicateCheckSql(migration: string): string {
  const lines = migration.split("\n");
  const start = lines.findIndex((line) => line.trim() === "-- duplicate-check:");
  const sql: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("-- ")) break;
    sql.push(line.slice(3));
  }
  return sql.join("\n");
}

function indexForPglite(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/\bCONCURRENTLY\b/g, "");
}

const stub = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE TABLE public.customer_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status_at timestamptz NOT NULL DEFAULT now(),
  user_email text,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'webhook')),
  template_key text,
  subject text,
  provider text,
  provider_message_id text,
  status text NOT NULL CHECK (status IN (
    'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained', 'suppressed'
  )),
  source text NOT NULL,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
`;

test("delinquency downgrade does not rewrite agency ids and grace can store the claim key", () => {
  expect(delinquencyMigration).toContain("ADD COLUMN IF NOT EXISTS cancel_claim_key text");
  expect(delinquencyMigration).toContain("saassuite.skip_branding_refresh");
  expect(delinquencyMigration).toContain("menu_link_rules_active_agency_idx");
  expect(delinquencyMigration).not.toContain("agency_id LIKE '%NO'");
  expect(delinquencyMigration).not.toContain("CREATE INDEX CONCURRENTLY");
  expect(delinquencyMigration).toContain("GRANT EXECUTE ON FUNCTION public.mark_payment_delinquent(text, text) TO service_role");
});

test("cancel dedupe keeps the earliest row and the concurrent index file stays outside a transaction", async () => {
  expect(indexMigration).toMatch(/CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS/);
  expect(indexMigration).not.toMatch(/^\s*BEGIN\b/im);
  expect(indexMigration).not.toMatch(/^\s*COMMIT\b/im);
  expect(dedupeMigration).toContain("claim_subscription_canceled_message");
  expect(dedupeMigration).toContain("pg_advisory_xact_lock(hashtext('subscription_canceled:' || claim_key)::bigint)");
  expect(dedupeMigration).not.toContain("hashtext('subscription_canceled:' || p_provider_message_id)");
  expect(dedupeMigration).toContain("subscription_canceled claim requires a provider message id");
  expect(dedupeMigration).toContain("WHERE NOT EXISTS");
  expect(dedupeMigration).toContain("WHEN unique_violation THEN");
  expect(dedupeMigration).not.toContain("ON CONFLICT");

  const db = new PGlite();
  await db.exec(stub);
  await db.exec(`
    INSERT INTO public.customer_message_events
      (id, created_at, user_email, channel, template_key, provider, provider_message_id, status, source)
    VALUES
      ('00000000-0000-0000-0000-000000000001', '2026-10-01T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', '${duplicateKey}', 'queued', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000002', '2026-10-02T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', '${duplicateKey}', 'sent', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000003', '2026-10-03T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', '${duplicateKey}', 'failed', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000008', '2026-09-01T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', 'sub_tie:2026-09-01T00:00:00.000Z:immediate', 'queued', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000009', '2026-09-01T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', 'sub_tie:2026-09-01T00:00:00.000Z:immediate', 'sent', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000004', '2026-10-04T00:00:00Z', 'owner@agency.com', 'webhook', 'kit_purchased', 'ghl', '${duplicateKey}', 'sent', 'one-feature-kit-webhook'),
      ('00000000-0000-0000-0000-000000000005', '2026-10-01T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', 'sub_other:2026-12-01T00:00:00.000Z:access_kept', 'suppressed', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000006', '2026-10-01T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', NULL, 'suppressed', 'stripe-subscription-webhook'),
      ('00000000-0000-0000-0000-000000000007', '2026-10-02T00:00:00Z', 'owner@agency.com', 'webhook', 'subscription_canceled', 'ghl', NULL, 'suppressed', 'stripe-subscription-webhook');
  `);

  const checkSql = duplicateCheckSql(dedupeMigration);
  expect(checkSql.toLowerCase().startsWith("select")).toBe(true);
  expect(checkSql.toLowerCase()).not.toContain("delete");
  expect(checkSql.toLowerCase()).not.toContain("update");
  expect(checkSql.toLowerCase()).not.toContain("insert");

  const before = await db.query<{ provider_message_id: string; copies: number }>(checkSql);
  const dup = before.rows.find((row) => row.provider_message_id === duplicateKey);
  expect(dup?.copies).toBe(3);

  await db.exec(dedupeMigration);
  await db.exec(indexForPglite(indexMigration));

  const after = await db.query<{ provider_message_id: string; copies: number }>(checkSql);
  expect(after.rows).toEqual([]);

  const kept = await db.query<{ id: string; template_key: string; provider_message_id: string | null }>(
    `SELECT id::text, template_key, provider_message_id
     FROM public.customer_message_events
     ORDER BY id`,
  );
  expect(kept.rows.map((row) => row.id)).toEqual([
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000004",
    "00000000-0000-0000-0000-000000000005",
    "00000000-0000-0000-0000-000000000006",
    "00000000-0000-0000-0000-000000000007",
    "00000000-0000-0000-0000-000000000008",
  ]);
  expect(kept.rows.find((row) => row.id.endsWith("0004"))?.template_key).toBe("kit_purchased");

  const replay = await db.query<{ id: string }>(
    `SELECT id::text FROM public.claim_subscription_canceled_message(
      'owner@agency.com', $1, 'queued', 'stripe-subscription-webhook', NULL, '{"ghl_webhook":"pending"}'::jsonb
    )`,
    [duplicateKey],
  );
  expect(replay.rows).toEqual([]);

  const freshKey = "sub_new:2026-11-16T15:00:00.000Z:immediate";
  const first = await db.query<{ id: string }>(
    `SELECT id::text FROM public.claim_subscription_canceled_message(
      'owner@agency.com', $1, 'queued', 'stripe-subscription-webhook', NULL, '{"ghl_webhook":"pending","kind":"immediate"}'::jsonb
    )`,
    [freshKey],
  );
  const second = await db.query<{ id: string }>(
    `SELECT id::text FROM public.claim_subscription_canceled_message(
      'owner@agency.com', $1, 'queued', 'stripe-subscription-webhook', NULL, '{"ghl_webhook":"pending","kind":"immediate"}'::jsonb
    )`,
    [freshKey],
  );
  expect(first.rows).toHaveLength(1);
  expect(second.rows).toEqual([]);
  const copies = await db.query<{ copies: number }>(
    `SELECT count(*)::int AS copies
     FROM public.customer_message_events
     WHERE template_key = 'subscription_canceled' AND provider_message_id = $1`,
    [freshKey],
  );
  expect(copies.rows[0]?.copies).toBe(1);
});

async function openClaimDb(withIndex: boolean) {
  const db = new PGlite();
  await db.exec(stub);
  await db.exec(dedupeMigration);
  if (withIndex) await db.exec(indexForPglite(indexMigration));
  return db;
}

async function overlappingImmediateClaims(db: PGlite, key: string) {
  let posts = 0;
  const claim = () =>
    recordSubscriptionCanceled({
      email: "owner@agency.com",
      kind: "immediate",
      dedupeKey: key,
      insertMessage: async (row) => {
        const result = await db.query<{ id: string }>(
          `SELECT id::text AS id
           FROM public.claim_subscription_canceled_message($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            row.userEmail,
            row.providerMessageId,
            row.status,
            row.source,
            row.detail,
            JSON.stringify(row.metadata ?? {}),
          ],
        );
        return { ok: true, claimed: result.rows.length > 0 };
      },
      fetchImpl: async () => {
        posts += 1;
        return new Response("ok", { status: 200 });
      },
    });
  const [first, second] = await Promise.all([claim(), claim()]);
  const copies = await db.query<{ copies: number }>(
    `SELECT count(*)::int AS copies
     FROM public.customer_message_events
     WHERE template_key = 'subscription_canceled' AND provider_message_id = $1`,
    [key],
  );
  const again = await claim();
  return { first, second, again, posts, copies: copies.rows[0]?.copies };
}

test("with no unique index, overlapping claims write one row and post once", async () => {
  const db = await openClaimDb(false);
  const outcome = await overlappingImmediateClaims(db, "sub_no_index:2026-11-16T14:30:07.000Z:immediate");
  expect(outcome.copies).toBe(1);
  expect(outcome.posts).toBe(1);
  expect([outcome.first, outcome.second].filter((result) => result.webhookFired)).toHaveLength(1);
  expect([outcome.first, outcome.second].filter((result) => result.duplicate)).toHaveLength(1);
  expect(outcome.again).toEqual({ webhookFired: false, logged: false, duplicate: true });
  expect(outcome.posts).toBe(1);
});

test("with the unique index, overlapping claims write one row and post once", async () => {
  const db = await openClaimDb(true);
  const outcome = await overlappingImmediateClaims(db, "sub_with_index:2026-11-16T14:30:07.000Z:immediate");
  expect(outcome.copies).toBe(1);
  expect(outcome.posts).toBe(1);
  expect([outcome.first, outcome.second].filter((result) => result.webhookFired)).toHaveLength(1);
  expect([outcome.first, outcome.second].filter((result) => result.duplicate)).toHaveLength(1);
  expect(outcome.again).toEqual({ webhookFired: false, logged: false, duplicate: true });
  expect(outcome.posts).toBe(1);

  await db.exec(`
    CREATE OR REPLACE FUNCTION public.force_cancel_unique() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.provider_message_id = 'sub_force_unique' THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'duplicate key value violates unique constraint';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER force_cancel_unique
      BEFORE INSERT ON public.customer_message_events
      FOR EACH ROW EXECUTE FUNCTION public.force_cancel_unique();
  `);
  let forcedPosts = 0;
  const forced = await recordSubscriptionCanceled({
    email: "owner@agency.com",
    kind: "immediate",
    dedupeKey: "sub_force_unique",
    insertMessage: async (row) => {
      const result = await db.query<{ id: string }>(
        `SELECT id::text AS id
         FROM public.claim_subscription_canceled_message($1, $2, $3, $4, $5, $6::jsonb)`,
        [row.userEmail, row.providerMessageId, row.status, row.source, row.detail, JSON.stringify(row.metadata ?? {})],
      );
      return { ok: true, claimed: result.rows.length > 0 };
    },
    fetchImpl: async () => {
      forcedPosts += 1;
      return new Response("ok", { status: 200 });
    },
  });
  expect(forced).toEqual({ webhookFired: false, logged: false, duplicate: true });
  expect(forcedPosts).toBe(0);
});

test("a null or empty claim id raises, and the lock stores the trimmed key", async () => {
  const db = await openClaimDb(false);
  const claim = (id: string | null) => db.query(
    `SELECT id::text FROM public.claim_subscription_canceled_message(
      'owner@agency.com', $1, 'queued', 'stripe-subscription-webhook', NULL, '{}'::jsonb
    )`,
    [id],
  );
  await expect(claim(null)).rejects.toThrow(/provider message id/);
  await expect(claim("")).rejects.toThrow(/provider message id/);
  await expect(claim("   ")).rejects.toThrow(/provider message id/);

  const trimmed = "sub_trim:2026-11-16T14:30:07.000Z:immediate";
  const first = await claim(`  ${trimmed}  `);
  expect(first.rows).toHaveLength(1);
  const stored = await db.query<{ provider_message_id: string }>(
    `SELECT provider_message_id FROM public.customer_message_events WHERE id = $1`,
    [first.rows[0]?.id],
  );
  expect(stored.rows[0]?.provider_message_id).toBe(trimmed);
  const second = await claim(trimmed);
  expect(second.rows).toEqual([]);
});

test("grace and the period-end delete share one immediate post in either order", async () => {
  const until = "2026-11-16T14:30:07.000Z";
  const subscriptionId = "sub_period_end";
  const key = cancelDedupeKey(subscriptionId, until, "immediate");
  const fromPrior = immediateClaimKeyFromPrior([
    {
      metadata: {
        kind: "access_kept",
        subscription_id: subscriptionId,
        access_until: until,
        immediate_claim_key: key,
      },
    },
    {
      metadata: {
        subscription_id: "sub_other",
        access_until: "2026-12-01T00:00:00.000Z",
        immediate_claim_key: "sub_other:2026-12-01T00:00:00.000Z:immediate",
      },
    },
  ], until);
  expect(fromPrior).toBe(key);
  expect(immediateClaimKeyFromPrior([
    { metadata: { subscription_id: subscriptionId, access_until: "2026-11-16T14:30:07+00:00" } },
  ], until)).toBe(key);

  const deleted = planSubscriptionCancel({
    eventType: "customer.subscription.deleted",
    subscriptionId,
    status: "canceled",
    periodEndMs: Date.parse(until),
    nowMs: Date.parse(until) + 1000,
  });
  expect(deleted.kind).toBe("immediate");
  expect(deleted.dedupeKey).toBe(fromPrior);

  const runOrder = async (first: "grace" | "delete") => {
    const db = await openClaimDb(false);
    const posts: string[] = [];
    const send = (source: string, body?: Record<string, unknown>) => recordSubscriptionCanceled({
      email: "owner@agency.com",
      kind: "immediate",
      dedupeKey: key,
      source,
      webhookBody: body,
      insertMessage: async (row) => {
        const result = await db.query<{ id: string }>(
          `SELECT id::text AS id
           FROM public.claim_subscription_canceled_message($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            row.userEmail,
            row.providerMessageId,
            row.status,
            row.source,
            row.detail,
            JSON.stringify(row.metadata ?? {}),
          ],
        );
        return { ok: true, claimed: result.rows.length > 0 };
      },
      fetchImpl: async (_url, init) => {
        posts.push(String(init?.body ?? ""));
        return new Response("ok", { status: 200 });
      },
    });
    const grace = () => send("expire-payment-grace", {
      email: "owner@agency.com",
      reason: "stripe_canceled_period_end",
    });
    const remove = () => send("stripe-subscription-webhook");
    if (first === "grace") {
      await grace();
      await remove();
    } else {
      await remove();
      await grace();
    }
    const copies = await db.query<{ copies: number }>(
      `SELECT count(*)::int AS copies
       FROM public.customer_message_events
       WHERE template_key = 'subscription_canceled' AND provider_message_id = $1`,
      [key],
    );
    expect(copies.rows[0]?.copies).toBe(1);
    expect(posts).toHaveLength(1);
    return posts[0];
  };

  const graceFirst = await runOrder("grace");
  expect(graceFirst).toBe(JSON.stringify({
    email: "owner@agency.com",
    reason: "stripe_canceled_period_end",
  }));
  const deleteFirst = await runOrder("delete");
  expect(deleteFirst).toBe(JSON.stringify({ email: "owner@agency.com" }));
});
