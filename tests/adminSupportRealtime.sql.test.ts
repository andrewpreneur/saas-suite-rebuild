import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL("../supabase/migrations/20261106194500_admin_support_realtime_rls.sql", import.meta.url),
  "utf8",
);

const stub = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE OR REPLACE FUNCTION public.current_auth_email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('test.email', true), '')
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.current_auth_email() IN (
    'andrew@dna-media.net',
    'team@yoursoftwareonboarding.com'
  )
$$;

CREATE OR REPLACE FUNCTION public.platform_support_agency_key(p_agency_id text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(lower(regexp_replace(btrim(coalesce(p_agency_id, '')), 'NO$', '', 'i')), '')
$$;

CREATE OR REPLACE FUNCTION public.can_access_agency(p_agency_id text)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'can_access_agency should not run for platform-admin selects';
  END IF;
  IF public.current_auth_email() = 'owner@example.com' THEN
    RETURN p_agency_id = 'owner-agency';
  END IF;
  IF public.current_auth_email() = 'ethan@buzzbullmarketing.com' THEN
    RETURN p_agency_id IN ('buzzbull-marketing-systems', 'buzzbull-marketing-systems-2');
  END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.support_can_see_chat(p_agency_id text, p_user_identifier text)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'slow per-row platform exclusion check';
  END IF;
  RETURN p_user_identifier IS DISTINCT FROM 'hidden-chat@example.com'
    AND p_user_identifier IS DISTINCT FROM 'assigned-to-other@example.com';
END $$;

CREATE OR REPLACE FUNCTION public.support_can_see_ticket(p_agency_id text, p_assigned_to text)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'slow per-row platform exclusion check';
  END IF;
  RETURN coalesce(p_assigned_to, '') IS DISTINCT FROM 'someone-else@example.com';
END $$;

CREATE TABLE public.saas_suite_users (
  email text,
  agency_id text,
  agency_id_basic text,
  agency_id_advanced text,
  agency_id_elite text
);
CREATE TABLE public.platform_support_excluded_agencies (owner_email text);
CREATE TABLE public.chat_threads (
  id integer PRIMARY KEY,
  agency_id text,
  user_identifier text
);
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY,
  agency_id text,
  assigned_to text,
  customer_email text
);
CREATE TABLE public.ai_chat_messages (
  id integer PRIMARY KEY,
  agency_id text,
  user_identifier text,
  created_at timestamptz
);
CREATE TABLE public.agency_owner_messages (id uuid PRIMARY KEY);
CREATE TABLE public.support_ticket_replies (
  id uuid PRIMARY KEY,
  ticket_id uuid,
  sender_role text,
  body text
);

ALTER TABLE public.saas_suite_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_support_excluded_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.saas_suite_users, public.platform_support_excluded_agencies,
  public.chat_threads, public.support_tickets, public.ai_chat_messages,
  public.support_ticket_replies TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_auth_email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_support_agency_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_agency(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_can_see_chat(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_can_see_ticket(text, text) TO anon, authenticated;

INSERT INTO public.saas_suite_users (email, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
VALUES (
  'curtisv@buzzbullmarketing.com',
  'buzzbull-marketing-systems',
  'buzzbull-marketing-systems',
  'buzzbull-marketing-systems-2',
  'buzzbull-marketing-systems-3'
), (
  'excluded@example.com', 'excluded', 'excluded', 'excluded-2', 'excluded-3'
);

INSERT INTO public.platform_support_excluded_agencies (owner_email)
VALUES ('curtisv@buzzbullmarketing.com'), ('excluded@example.com');

INSERT INTO public.chat_threads (id, agency_id, user_identifier) VALUES
  (1, 'keystone', 'fran@digitalaspect.io'),
  (2, 'buzzbull-marketing-systems', 'customer@example.com'),
  (3, 'buzzbull-marketing-systems-2NO', 'customer@example.com'),
  (4, '', 'blank-agency@example.com'),
  (5, 'buzzbull-marketing-systems', 'hidden-chat@example.com');

INSERT INTO public.support_tickets (id, agency_id, assigned_to, customer_email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'keystone', null, 'fran@digitalaspect.io'),
  ('22222222-2222-4222-8222-222222222222', 'buzzbull-marketing-systems', null, 'customer@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'buzzbull-marketing-systems-3', 'someone-else@example.com', 'andrew@dna-media.net'),
  ('44444444-4444-4444-8444-444444444444', 'keystone', 'someone-else@example.com', 'ethan@buzzbullmarketing.com'),
  ('55555555-5555-4555-8555-555555555555', 'owner-agency', null, 'customer@example.com');

INSERT INTO public.ai_chat_messages (id, agency_id, user_identifier, created_at) VALUES
  (1, 'champagne-room', 'deborah@deborahcarlislesolomon.com', now()),
  (2, 'excluded-2NO', 'customer@example.com', now()),
  (3, 'owner-agency', 'customer@example.com', now()),
  (4, 'owner-agency', 'assigned-to-other@example.com', now()),
  (5, 'unrelated', 'OWNER@EXAMPLE.COM', now());

INSERT INTO public.support_ticket_replies (id, ticket_id, sender_role, body) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'customer', 'keystone'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', 'customer', 'excluded'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '33333333-3333-4333-8333-333333333333', 'customer', 'admin customer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', '55555555-5555-4555-8555-555555555555', 'customer', 'owner');
`;

function policyBodies(sql: string): string[] {
  return sql
    .split(/CREATE POLICY/i)
    .slice(1)
    .map((body) => body.split(/;\s*\n/)[0]);
}

test("support select policies stay function calls so realtime can authorize them", () => {
  const bodies = policyBodies(migration);
  expect(bodies.length).toBe(4);
  for (const body of bodies) {
    expect(body.toLowerCase()).not.toContain("cross join");
    expect(body).not.toContain("platform_support_excluded_agencies");
    expect(body).not.toContain("platform_support_excluded_agency_ids");
  }
  expect(migration).toContain("SECURITY DEFINER");
  expect(migration).toContain(
    "<> ALL (COALESCE((SELECT public.platform_support_excluded_keys()), ARRAY[]::text[]))",
  );
  expect(migration).toContain("(SELECT public.is_platform_admin())");
  expect(migration).toContain("NULLIF((SELECT public.current_auth_email()), '')");
  expect(migration).toContain(
    "GRANT EXECUTE ON FUNCTION public.platform_support_agency_key(text) TO anon, authenticated, service_role;",
  );
  expect(migration).toContain("WHEN NOT public.is_platform_admin() THEN ARRAY[]::text[]");
  expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.support_can_see_chat");
  for (const body of bodies) {
    expect(body).toContain("TO authenticated");
    expect(body).not.toMatch(/FOR SELECT\s+USING/);
  }
});

async function asUser<T>(
  db: PGlite,
  email: string,
  role: "authenticated" | "anon",
  run: () => Promise<T>,
) {
  await db.query("SELECT set_config('test.email', $1, false)", [email]);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("RESET ROLE");
  }
}

async function database() {
  const db = new PGlite();
  await db.exec(stub);
  await db.exec(migration);
  return db;
}

test("platform admin still hides excluded agencies without the per-row exclusion scan", async () => {
  const db = await database();
  try {
    const threads = await asUser(db, "andrew@dna-media.net", "authenticated", async () => {
      const result = await db.query<{ agency_id: string }>(
        "SELECT agency_id FROM public.chat_threads ORDER BY id",
      );
      return result.rows.map((row) => row.agency_id);
    });
    expect(threads).toEqual(["keystone", ""]);

    const tickets = await asUser(db, "andrew@dna-media.net", "authenticated", async () => {
      const result = await db.query<{ id: string }>(
        "SELECT id::text AS id FROM public.support_tickets ORDER BY id",
      );
      return result.rows.map((row) => row.id);
    });
    expect(tickets).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ]);

    const teamTickets = await asUser(db, "team@yoursoftwareonboarding.com", "authenticated", async () => {
      const result = await db.query<{ id: string }>(
        "SELECT id::text AS id FROM public.support_tickets ORDER BY id",
      );
      return result.rows.map((row) => row.id);
    });
    expect(teamTickets).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ]);

    const messages = await asUser(db, "andrew@dna-media.net", "authenticated", async () => {
      const result = await db.query<{ id: number }>(
        "SELECT id FROM public.ai_chat_messages ORDER BY id",
      );
      return result.rows.map((row) => row.id);
    });
    expect(messages).toEqual([1, 3, 4, 5]);

    const replies = await asUser(db, "andrew@dna-media.net", "authenticated", async () => {
      const result = await db.query<{ body: string }>(
        "SELECT body FROM public.support_ticket_replies ORDER BY body",
      );
      return result.rows.map((row) => row.body);
    });
    expect(replies).toEqual(["admin customer", "keystone", "owner"]);

    const policies = await db.query<{ relname: string; expr: string }>(`
      SELECT c.relname, pg_get_expr(p.polqual, p.polrelid) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('chat_threads', 'support_tickets', 'ai_chat_messages', 'support_ticket_replies')
        AND p.polcmd = 'r'
    `);
    for (const policy of policies.rows) {
      expect(policy.expr.toLowerCase()).not.toContain("platform_support_excluded_agencies");
      expect(policy.expr.toLowerCase()).not.toContain("cross join");
    }

    const roles = await db.query<{ relname: string; roles: string[] | null }>(`
      SELECT c.relname,
        ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY (p.polroles) ORDER BY r.rolname) AS roles
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('chat_threads', 'support_tickets', 'ai_chat_messages', 'support_ticket_replies')
        AND p.polcmd = 'r'
    `);
    expect(roles.rows.map((row) => row.relname).sort()).toEqual([
      "ai_chat_messages",
      "chat_threads",
      "support_ticket_replies",
      "support_tickets",
    ]);
    for (const row of roles.rows) expect(row.roles).toEqual(["authenticated"]);

    const anonKey = await db.query<{ ok: boolean }>(
      "SELECT has_function_privilege('anon', 'public.platform_support_agency_key(text)', 'EXECUTE') AS ok",
    );
    expect(anonKey.rows[0].ok).toBe(true);

    const plan = await asUser(db, "andrew@dna-media.net", "authenticated", async () => {
      const result = await db.query<{ "QUERY PLAN": string }>(
        "EXPLAIN SELECT id FROM public.ai_chat_messages",
      );
      return result.rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
    expect(plan).toContain("InitPlan 1");
    expect(plan).toContain("InitPlan 2");
    expect(plan).toContain("InitPlan 3");
    expect(plan).toContain("<> ALL");
  } finally {
    await db.close();
  }
});

test("agency members, customers, and anonymous callers keep the same support reads", async () => {
  const db = await database();
  try {
    const ownerMessages = await asUser(db, "owner@example.com", "authenticated", async () => {
      const result = await db.query<{ id: number }>(
        "SELECT id FROM public.ai_chat_messages ORDER BY id",
      );
      return result.rows.map((row) => row.id);
    });
    expect(ownerMessages).toEqual([3, 5]);

    const ownerReplies = await asUser(db, "owner@example.com", "authenticated", async () => {
      const result = await db.query<{ body: string }>(
        "SELECT body FROM public.support_ticket_replies",
      );
      return result.rows.map((row) => row.body);
    });
    expect(ownerReplies).toEqual(["owner"]);

    const stranger = await asUser(db, "stranger@example.com", "authenticated", async () => {
      const messages = await db.query<{ id: number }>("SELECT id FROM public.ai_chat_messages");
      const replies = await db.query<{ id: string }>(
        "SELECT id::text AS id FROM public.support_ticket_replies",
      );
      const threads = await db.query<{ id: number }>("SELECT id FROM public.chat_threads");
      return { messages: messages.rows, replies: replies.rows, threads: threads.rows };
    });
    expect(stranger).toEqual({ messages: [], replies: [], threads: [] });

    const anon = await asUser(db, "", "anon", async () => {
      const replies = await db.query<{ id: string }>(
        "SELECT id::text AS id FROM public.support_ticket_replies",
      );
      const messages = await db.query<{ id: number }>("SELECT id FROM public.ai_chat_messages");
      return { replies: replies.rows, messages: messages.rows };
    });
    expect(anon).toEqual({ replies: [], messages: [] });

    const leaked = await asUser(db, "ethan@buzzbullmarketing.com", "authenticated", async () => {
      const result = await db.query<{ agency_id: string }>(
        "SELECT public.platform_support_excluded_keys() AS keys",
      );
      return result.rows[0];
    });
    expect(leaked).toEqual({ keys: [] });

    const agencyThreads = await asUser(
      db,
      "ethan@buzzbullmarketing.com",
      "authenticated",
      async () => {
        const result = await db.query<{ id: number }>(
          "SELECT id FROM public.chat_threads ORDER BY id",
        );
        return result.rows.map((row) => row.id);
      },
    );
    expect(agencyThreads).toEqual([2]);
  } finally {
    await db.close();
  }
});
