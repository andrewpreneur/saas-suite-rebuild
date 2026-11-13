import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL("../supabase/migrations/20261021235000_support_excluded_agencies.sql", import.meta.url),
  "utf8",
);

const stub = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('email', 'ethan@buzzbullmarketing.com') $$;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE TABLE public.platform_admin_flag (enabled boolean NOT NULL);
INSERT INTO public.platform_admin_flag VALUES (false);

CREATE OR REPLACE FUNCTION public.current_auth_email() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT 'ethan@buzzbullmarketing.com' $$;

CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT enabled FROM public.platform_admin_flag LIMIT 1 $$;

CREATE TABLE public.saas_suite_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text,
  agency_id text,
  agency_id_basic text,
  agency_id_advanced text,
  agency_id_elite text
);

CREATE TABLE public.account_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text,
  admin_email text,
  status text,
  permissions jsonb,
  restrict_assigned_chats boolean,
  restrict_assigned_tickets boolean
);

CREATE TABLE public.support_chat_assignments (
  agency_id text,
  user_identifier text,
  assigned_to_email text
);

CREATE OR REPLACE FUNCTION public.support_admin_row(p_agency_id text)
RETURNS public.account_admins
LANGUAGE sql STABLE AS $$
  SELECT * FROM public.account_admins WHERE false LIMIT 1
$$;

INSERT INTO public.saas_suite_users (email, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
VALUES
  ('curtisv@buzzbullmarketing.com', 'buzzbull-marketing-systems', 'buzzbull-marketing-systems', 'buzzbull-marketing-systems-2', 'buzzbull-marketing-systems-3'),
  ('owner@launch360.example', 'Launch360', 'launch360', 'launch360-2', 'launch360-3'),
  ('fran@digitalaspect.io', 'keystone', 'keystone', 'keystone-2', 'keystone-3');
`;

test("excluded owners match launch360 and buzzbull ids and agency members still see them", async () => {
  const db = new PGlite();
  await db.exec(stub);
  await db.exec(migration);

  const excluded = async (agencyId: string) => {
    const result = await db.query<{ excluded: boolean }>(
      "SELECT public.is_platform_support_excluded($1) AS excluded",
      [agencyId],
    );
    return result.rows[0].excluded;
  };

  expect(await excluded("launch360")).toBe(true);
  expect(await excluded("Launch360NO")).toBe(true);
  expect(await excluded("launch360-2")).toBe(true);
  expect(await excluded("launch360-3")).toBe(true);
  expect(await excluded("buzzbull-marketing-systems")).toBe(true);
  expect(await excluded("buzzbull-marketing-systems-2")).toBe(true);
  expect(await excluded("buzzbull-marketing-systems-3NO")).toBe(true);
  expect(await excluded("keystone")).toBe(false);
  expect(await excluded("keystone-2")).toBe(false);
  expect(await excluded("")).toBe(false);
  expect(await excluded("public-support")).toBe(false);
  expect(await excluded("public-supportNO")).toBe(false);

  const ids = await db.query<{ agency_id: string }>(
    "SELECT agency_id FROM public.platform_support_excluded_agency_ids() ORDER BY agency_id",
  );
  expect(ids.rows.map((row) => row.agency_id)).toEqual([
    "buzzbull-marketing-systems",
    "buzzbull-marketing-systems-2",
    "buzzbull-marketing-systems-3",
    "launch360",
    "launch360-2",
    "launch360-3",
  ]);

  const seeded = await db.query<{ owner_email: string; reason: string }>(
    "SELECT owner_email, reason FROM public.platform_support_excluded_agencies ORDER BY owner_email",
  );
  expect(seeded.rows).toEqual([
    { owner_email: "curtisv@buzzbullmarketing.com", reason: "runs own support" },
    { owner_email: "owner@launch360.example", reason: "runs own support" },
  ]);

  const agencySees = await db.query<{ visible: boolean }>(
    "SELECT public.support_can_see_chat('buzzbull-marketing-systems', 'customer@example.com') AS visible",
  );
  expect(agencySees.rows[0].visible).toBe(true);
  const agencyTicket = await db.query<{ visible: boolean }>(
    "SELECT public.support_can_see_ticket('launch360-2', 'ethan@buzzbullmarketing.com') AS visible",
  );
  expect(agencyTicket.rows[0].visible).toBe(true);

  await db.exec("UPDATE public.platform_admin_flag SET enabled = true");
  const platformChat = await db.query<{ visible: boolean }>(
    "SELECT public.support_can_see_chat('buzzbull-marketing-systems-2NO', 'customer@example.com') AS visible",
  );
  expect(platformChat.rows[0].visible).toBe(false);
  const platformTicket = await db.query<{ visible: boolean }>(
    "SELECT public.support_can_see_ticket('launch360', null) AS visible",
  );
  expect(platformTicket.rows[0].visible).toBe(false);
  const platformOther = await db.query<{ visible: boolean }>(
    "SELECT public.support_can_see_chat('keystone', 'fran@digitalaspect.io') AS visible",
  );
  expect(platformOther.rows[0].visible).toBe(true);
  const publicForm = await db.query<{ visible: boolean }>(
    "SELECT public.support_can_see_ticket('public-support', null) AS visible",
  );
  expect(publicForm.rows[0].visible).toBe(true);

  await db.close();
});
