import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL("../supabase/migrations/20261101203000_platform_admin_support_select.sql", import.meta.url),
  "utf8",
);

const stub = `
CREATE ROLE authenticated;

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
  RETURN p_agency_id IN ('buzzbull-marketing-systems', 'buzzbull-marketing-systems-2');
END $$;

CREATE OR REPLACE FUNCTION public.support_can_see_chat(p_agency_id text, p_user_identifier text)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'support_can_see_chat should not run for platform-admin selects';
  END IF;
  RETURN p_user_identifier IS DISTINCT FROM 'hidden-chat@example.com';
END $$;

CREATE OR REPLACE FUNCTION public.support_can_see_ticket(p_agency_id text, p_assigned_to text)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'support_can_see_ticket should not run for platform-admin selects';
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

CREATE TABLE public.platform_support_excluded_agencies (
  owner_email text PRIMARY KEY
);

CREATE TABLE public.chat_threads (
  id integer PRIMARY KEY,
  agency_id text,
  user_identifier text
);

CREATE TABLE public.support_tickets (
  id integer PRIMARY KEY,
  agency_id text,
  assigned_to text,
  customer_email text
);

ALTER TABLE public.saas_suite_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_support_excluded_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY see_users ON public.saas_suite_users
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR lower(email) = public.current_auth_email());

CREATE POLICY see_excluded ON public.platform_support_excluded_agencies
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT ON public.saas_suite_users, public.platform_support_excluded_agencies,
  public.chat_threads, public.support_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_auth_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_support_agency_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_agency(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_can_see_chat(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_can_see_ticket(text, text) TO authenticated;

INSERT INTO public.saas_suite_users (email, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
VALUES (
  'curtisv@buzzbullmarketing.com',
  'buzzbull-marketing-systems',
  'buzzbull-marketing-systems',
  'buzzbull-marketing-systems-2',
  'buzzbull-marketing-systems-3'
);

INSERT INTO public.platform_support_excluded_agencies (owner_email)
VALUES ('curtisv@buzzbullmarketing.com');

INSERT INTO public.chat_threads (id, agency_id, user_identifier) VALUES
  (1, 'keystone', 'fran@digitalaspect.io'),
  (2, 'buzzbull-marketing-systems', 'customer@example.com'),
  (3, 'buzzbull-marketing-systems-2NO', 'customer@example.com'),
  (4, '', 'blank-agency@example.com'),
  (5, 'buzzbull-marketing-systems', 'hidden-chat@example.com');

INSERT INTO public.support_tickets (id, agency_id, assigned_to, customer_email) VALUES
  (1, 'keystone', null, 'fran@digitalaspect.io'),
  (2, 'buzzbull-marketing-systems', null, 'customer@example.com'),
  (3, 'buzzbull-marketing-systems-3', 'someone-else@example.com', 'andrew@dna-media.net'),
  (4, 'keystone', 'someone-else@example.com', 'ethan@buzzbullmarketing.com');
`;

async function asUser<T>(db: PGlite, email: string, run: () => Promise<T>) {
  await db.exec(`SELECT set_config('test.email', '${email}', false)`);
  await db.exec("SET ROLE authenticated");
  try {
    return await run();
  } finally {
    await db.exec("RESET ROLE");
  }
}

test("platform-admin inbox select hides excluded agencies in one lookup", async () => {
  expect(migration).toContain('<> ALL (ARRAY(');
  expect(migration).toContain("NOT public.is_platform_admin()");
  expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.support_can_see_chat");
  expect(migration).not.toContain("platform_support_excluded_agency_ids");

  const db = new PGlite();
  await db.exec(stub);
  await db.exec(migration);

  const threads = await asUser(db, "andrew@dna-media.net", async () => {
    const result = await db.query<{ agency_id: string; user_identifier: string }>(
      "SELECT agency_id, user_identifier FROM public.chat_threads ORDER BY id",
    );
    return result.rows;
  });
  expect(threads).toEqual([
    { agency_id: "keystone", user_identifier: "fran@digitalaspect.io" },
    { agency_id: "", user_identifier: "blank-agency@example.com" },
  ]);

  const tickets = await asUser(db, "andrew@dna-media.net", async () => {
    const result = await db.query<{ id: number }>(
      "SELECT id FROM public.support_tickets ORDER BY id",
    );
    return result.rows.map((row) => row.id);
  });
  // 2 is an excluded agency. 3 is excluded too, but the customer is the platform admin.
  // 4 is keystone, so the assignee restriction on the non-admin path does not apply.
  expect(tickets).toEqual([1, 3, 4]);

  const teamTickets = await asUser(db, "team@yoursoftwareonboarding.com", async () => {
    const result = await db.query<{ id: number }>(
      "SELECT id FROM public.support_tickets ORDER BY id",
    );
    return result.rows.map((row) => row.id);
  });
  // Ticket 3 stays visible only for Andrew: the agency is excluded and the customer is his email.
  expect(teamTickets).toEqual([1, 4]);

  const agencyThreads = await asUser(db, "ethan@buzzbullmarketing.com", async () => {
    const result = await db.query<{ id: number }>(
      "SELECT id FROM public.chat_threads ORDER BY id",
    );
    return result.rows.map((row) => row.id);
  });
  // Agency members still see their own queue, including ids the platform inbox hides.
  // hidden-chat is removed by support_can_see_chat, not by the exclusion list.
  expect(agencyThreads).toEqual([2]);

  const agencyTickets = await asUser(db, "ethan@buzzbullmarketing.com", async () => {
    const result = await db.query<{ id: number }>(
      "SELECT id FROM public.support_tickets ORDER BY id",
    );
    return result.rows.map((row) => row.id);
  });
  // Own agency ticket, plus the ticket whose customer_email is the signed-in user.
  expect(agencyTickets).toEqual([2, 4]);

  await db.close();
});
