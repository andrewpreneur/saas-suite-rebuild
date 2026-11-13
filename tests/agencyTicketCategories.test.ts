import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  DEFAULT_TICKET_CATEGORIES,
  buildTicketTypeEditorRows,
  mergeTicketCategoryOptions,
  moveTicketType,
  normalizeAgencyTicketCategories,
  ticketTypeLabelError,
  visibleTicketCategories,
} from "../src/lib/ticketCategories";

const CATEGORY_MIGRATION = "supabase/migrations/20261021232000_agency_ticket_categories.sql";
const RLS_MIGRATION = "supabase/migrations/20261021233000_fix_agency_category_settings_rls.sql";

type Category = { label: string; is_default: boolean; sort_order: number };

const prelude = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(current_setting('request.jwt.claims', true), '') = '' THEN '{}'::jsonb
    ELSE current_setting('request.jwt.claims', true)::jsonb
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_auth_email() IN (
    'andrew@dna-media.net',
    'team@yoursoftwareonboarding.com'
  );
$$;

CREATE TABLE public.account_admins (
  owner_email text,
  admin_email text,
  status text
);

CREATE OR REPLACE FUNCTION public.can_access_owner_email(p_owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR lower(coalesce(p_owner_email, '')) = public.current_auth_email()
    OR EXISTS (
      SELECT 1
      FROM public.account_admins aa
      WHERE lower(aa.owner_email) = lower(coalesce(p_owner_email, ''))
        AND lower(aa.admin_email) = public.current_auth_email()
        AND aa.status = 'accepted'
    );
$$;

CREATE TABLE public.saas_suite_users (
  email text,
  agency_id text,
  agency_id_basic text,
  agency_id_advanced text,
  agency_id_elite text,
  original_agency_id text,
  original_agency_id_basic text,
  original_agency_id_advanced text,
  original_agency_id_elite text,
  agency_name text
);

CREATE OR REPLACE FUNCTION public.can_access_agency(p_agency_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.saas_suite_users ssu
      WHERE public.can_access_owner_email(ssu.email)
        AND p_agency_id IS NOT NULL
        AND p_agency_id IN (
          ssu.agency_id,
          ssu.agency_id_basic,
          ssu.agency_id_advanced,
          ssu.agency_id_elite,
          ssu.original_agency_id,
          ssu.original_agency_id_basic,
          ssu.original_agency_id_advanced,
          ssu.original_agency_id_elite,
          ssu.agency_name
        )
    );
$$;
`;

function asCategories(value: unknown): Category[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return parsed as Category[];
}

async function categoriesFor(db: PGlite, agencyId: string) {
  const result = await db.query<{ categories: unknown }>(
    `SELECT public.get_agency_ticket_categories($1) AS categories`,
    [agencyId],
  );
  return asCategories(result.rows[0].categories);
}

function labelsOf(rows: Category[]) {
  return rows.map((row) => row.label);
}

async function asUser<T>(db: PGlite, email: string, role: string, run: () => Promise<T>) {
  await db.exec(`SELECT set_config('request.jwt.claims', '{"email":"${email}"}', false)`);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("RESET ROLE");
  }
}

async function denied(run: () => Promise<unknown>) {
  try {
    await run();
    return "";
  } catch (error) {
    return String(error);
  }
}

describe("ticket category list helpers", () => {
  test("the app default list matches the migration, including Website Edits", () => {
    const sql = readFileSync(CATEGORY_MIGRATION, "utf8");
    const match = sql.match(/SELECT ARRAY\[([\s\S]*?)\]::text\[\]/);
    const labels = [...(match?.[1].matchAll(/'([^']+)'/g) || [])].map((item) => item[1]);
    expect(labels).toEqual([...DEFAULT_TICKET_CATEGORIES]);
    expect(labels).toContain("Website Edits");
    expect(labels).toContain("Billing Question");
    expect(labels).toContain("General Inquiry");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_agency_ticket_categories(text) TO anon, authenticated, service_role");
    expect(sql).not.toContain("get_agency_chat_config");
  });

  test("chat create and support settings read the agency list", () => {
    const dialog = readFileSync("src/components/support/OpenTicketFromChatDialog.tsx", "utf8");
    const settings = readFileSync("src/components/SupportTicketing.tsx", "utf8");
    expect(dialog).toContain("useAgencyTicketCategories");
    expect(dialog).not.toContain("General Question");
    expect(settings).toContain("TicketTypesCard");
    expect(settings).toContain("mergeTicketCategoryOptions");
    expect(settings).not.toContain('"General", "Technical", "Billing"');
  });

  test("options keep agency labels and still include older ticket categories", () => {
    expect(mergeTicketCategoryOptions(
      ["Website Edits", "Billing Question"],
      ["Billing", "website edits", "", null, "General"],
    )).toEqual(["Website Edits", "Billing Question", "Billing", "General"]);
  });

  test("a bad payload falls back by throwing, and a real list is kept", () => {
    expect(() => normalizeAgencyTicketCategories({ label: "Website Edits" })).toThrow();
    expect(normalizeAgencyTicketCategories('[{"label":" Website Edits ","is_default":true,"sort_order":4}]')).toEqual([
      { label: "Website Edits", is_default: true, sort_order: 4 },
    ]);
  });

  test("the editor lists standard types, hides one, and moves a custom type", () => {
    const rows = buildTicketTypeEditorRows([
      { label: "website edits", sort_order: 4, is_hidden: true, is_default: true },
      { label: "Onboarding", sort_order: 1, is_hidden: false, is_default: false },
    ]);
    expect(rows.find((row) => row.label === "Website Edits")?.is_hidden).toBe(true);
    expect(rows.find((row) => row.label === "Onboarding")?.is_default).toBe(false);
    expect(visibleTicketCategories([
      { label: "Website Edits", sort_order: 4, is_hidden: true, is_default: true },
      { label: "Onboarding", sort_order: -1, is_hidden: false, is_default: false },
    ]).map((row) => row.label)[0]).toBe("Onboarding");
    const moved = moveTicketType(rows.filter((row) => !row.is_hidden), "Onboarding", 1);
    expect(moved.slice(0, 3).map((row) => row.label)).toEqual(["General Inquiry", "Technical Issue", "Onboarding"]);
    expect(ticketTypeLabelError("  ", [])).toBe("Enter a ticket type");
    expect(ticketTypeLabelError("Website Edits", ["Website Edits"])).toMatch(/already exists/);
    expect(ticketTypeLabelError("x".repeat(81), [])).toMatch(/80/);
  });
});

describe("get_agency_ticket_categories and category settings RLS", () => {
  test("defaults, hidden types, custom types, tier ids, and ownership", async () => {
    const db = new PGlite();
    await db.exec(prelude);
    await db.exec(readFileSync(CATEGORY_MIGRATION, "utf8"));
    await db.exec(`
      INSERT INTO public.saas_suite_users (email, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
      VALUES
        ('owner@example.com', 'agency-main', 'agency-basic', 'agency-advanced', 'agency-elite'),
        ('stranger@example.com', 'other-agency', 'other-basic', NULL, NULL);
      INSERT INTO public.account_admins (owner_email, admin_email, status)
      VALUES ('owner@example.com', 'admin@example.com', 'accepted');
    `);

    const defaults = await categoriesFor(db, "does-not-exist");
    expect(labelsOf(defaults)).toEqual([...DEFAULT_TICKET_CATEGORIES]);
    expect(defaults.every((row) => row.is_default)).toBe(true);
    expect(defaults.map((row) => row.sort_order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(labelsOf(await categoriesFor(db, ""))).toEqual([...DEFAULT_TICKET_CATEGORIES]);

    await db.exec(`
      INSERT INTO public.agency_ticket_categories (owner_email, label, is_default, is_hidden, sort_order)
      VALUES
        ('Owner@Example.com', 'website edits', true, true, 4),
        ('owner@example.com', 'Onboarding', false, false, 10),
        ('owner@example.com', 'Other', true, false, -1);
    `);
    const stored = await db.query<{ owner_email: string }>(
      `SELECT owner_email FROM public.agency_ticket_categories WHERE lower(label) = 'onboarding'`,
    );
    expect(stored.rows[0].owner_email).toBe("owner@example.com");

    const expected = ["Other", "General Inquiry", "Technical Issue", "Billing Question", "Account Access", "Feature Request", "Onboarding"];
    for (const agencyId of ["agency-main", "agency-basic", "agency-advanced", "agency-elite", "agency-eliteNO", "agency-mainno"]) {
      const rows = await categoriesFor(db, agencyId);
      expect(labelsOf(rows), agencyId).toEqual(expected);
      expect(rows.find((row) => row.label === "Onboarding")).toEqual({ label: "Onboarding", is_default: false, sort_order: 10 });
      expect(rows.find((row) => row.label === "Other")?.sort_order).toBe(-1);
      expect(rows.some((row) => row.label === "Website Edits")).toBe(false);
    }
    expect(labelsOf(await categoriesFor(db, "other-agency"))).toEqual([...DEFAULT_TICKET_CATEGORIES]);

    const anonRows = await asUser(db, "", "anon", () => categoriesFor(db, "agency-main"));
    expect(labelsOf(anonRows)).toEqual(expected);

    const tooLong = await denied(() => db.query(
      `INSERT INTO public.agency_ticket_categories (owner_email, label) VALUES ('owner@example.com', $1)`,
      ["x".repeat(81)],
    ));
    expect(tooLong).toMatch(/check|80|label/i);
    const duplicate = await denied(() => db.exec(
      `INSERT INTO public.agency_ticket_categories (owner_email, label) VALUES ('owner@example.com', 'ONBOARDING')`,
    ));
    expect(duplicate).toMatch(/unique|duplicate/i);

    const strangerInsert = await asUser(db, "stranger@example.com", "authenticated", () => denied(() => db.query(
      `INSERT INTO public.agency_ticket_categories (owner_email, label) VALUES ('owner@example.com', 'Sneaky')`,
    )));
    expect(strangerInsert).toMatch(/row-level security|permission/i);
    const strangerRead = await asUser(db, "stranger@example.com", "authenticated", () => db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.agency_ticket_categories WHERE owner_email = 'owner@example.com'`,
    ));
    expect(strangerRead.rows[0].n).toBe(0);

    await asUser(db, "owner@example.com", "authenticated", () => db.query(
      `INSERT INTO public.agency_ticket_categories (owner_email, label, is_default) VALUES ('owner@example.com', 'VIP', false)`,
    ));
    await asUser(db, "owner@example.com", "authenticated", () => db.query(
      `UPDATE public.agency_ticket_categories SET sort_order = 3 WHERE label = 'VIP'`,
    ));
    const ownerSees = await asUser(db, "owner@example.com", "authenticated", () => db.query<{ label: string }>(
      `SELECT label FROM public.agency_ticket_categories WHERE label = 'VIP'`,
    ));
    expect(ownerSees.rows.map((row) => row.label)).toEqual(["VIP"]);
    await asUser(db, "admin@example.com", "authenticated", () => db.query(
      `UPDATE public.agency_ticket_categories SET sort_order = 4 WHERE label = 'VIP'`,
    ));
    await asUser(db, "andrew@dna-media.net", "authenticated", () => db.query(
      `DELETE FROM public.agency_ticket_categories WHERE label = 'VIP'`,
    ));
    const gone = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.agency_ticket_categories WHERE label = 'VIP'`);
    expect(gone.rows[0].n).toBe(0);
    await asUser(db, "owner@example.com", "authenticated", () => db.query(
      `INSERT INTO public.agency_ticket_categories (owner_email, label, is_default) VALUES ('owner@example.com', 'Team', false)`,
    ));
    await asUser(db, "team@yoursoftwareonboarding.com", "authenticated", () => db.query(
      `DELETE FROM public.agency_ticket_categories WHERE label = 'Team'`,
    ));
    const teamGone = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.agency_ticket_categories WHERE label = 'Team'`);
    expect(teamGone.rows[0].n).toBe(0);

    const anonWrite = await asUser(db, "", "anon", () => denied(() => db.query(
      `INSERT INTO public.agency_ticket_categories (owner_email, label) VALUES ('owner@example.com', 'Anon')`,
    )));
    expect(anonWrite).toMatch(/permission denied/i);

    await db.exec(`
      CREATE TABLE public.agency_category_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agency_id text NOT NULL,
        tier text NOT NULL,
        category_key text NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        display_name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_category_settings TO anon, authenticated;
      ALTER TABLE public.agency_category_settings ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Public can read agency_category_settings"
        ON public.agency_category_settings FOR SELECT
        USING (true);
      CREATE POLICY "Owners manage their agency_category_settings"
        ON public.agency_category_settings FOR ALL
        TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.saas_suite_users u
          WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))
            AND agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.saas_suite_users u
          WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))
            AND agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
        ));
    `);

    await db.exec(`GRANT SELECT ON public.saas_suite_users TO authenticated`);
    await asUser(db, "stranger@example.com", "authenticated", () => db.query(
      `INSERT INTO public.agency_category_settings (agency_id, tier, category_key) VALUES ('agency-main', 'basic', 'before-fix')`,
    ));
    const leaked = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.agency_category_settings WHERE category_key = 'before-fix'`,
    );
    expect(leaked.rows[0].n).toBe(1);

    const fix = readFileSync(RLS_MIGRATION, "utf8");
    expect(fix).toContain("agency_category_settings.agency_id");
    expect(fix).toContain("is_platform_admin()");
    expect(fix).toContain("can_access_agency");
    expect(fix).not.toContain("AND agency_id IN (u.agency_id");
    await db.exec(fix);

    const blocked = await asUser(db, "stranger@example.com", "authenticated", () => denied(() => db.query(
      `INSERT INTO public.agency_category_settings (agency_id, tier, category_key) VALUES ('agency-main', 'basic', 'after-fix')`,
    )));
    expect(blocked).toMatch(/row-level security/i);
    const blockedUpdate = await asUser(db, "stranger@example.com", "authenticated", () => db.query<{ n: number }>(
      `WITH changed AS (
         UPDATE public.agency_category_settings SET category_key = 'hijack' WHERE agency_id = 'agency-main' RETURNING 1
       ) SELECT count(*)::int AS n FROM changed`,
    ));
    expect(blockedUpdate.rows[0].n).toBe(0);
    const stillReadable = await asUser(db, "stranger@example.com", "authenticated", () => db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.agency_category_settings WHERE agency_id = 'agency-main'`,
    ));
    expect(stillReadable.rows[0].n).toBe(1);

    await asUser(db, "owner@example.com", "authenticated", () => db.query(
      `INSERT INTO public.agency_category_settings (agency_id, tier, category_key) VALUES ('agency-basic', 'basic', 'owner-ok')`,
    ));
    await asUser(db, "admin@example.com", "authenticated", () => db.query(
      `INSERT INTO public.agency_category_settings (agency_id, tier, category_key) VALUES ('agency-advanced', 'advanced', 'admin-ok')`,
    ));
    await asUser(db, "andrew@dna-media.net", "authenticated", () => db.query(
      `INSERT INTO public.agency_category_settings (agency_id, tier, category_key) VALUES ('agency-elite', 'elite', 'platform-ok')`,
    ));
    const allowed = await db.query<{ category_key: string }>(
      `SELECT category_key FROM public.agency_category_settings WHERE category_key IN ('owner-ok', 'admin-ok', 'platform-ok') ORDER BY category_key`,
    );
    expect(allowed.rows.map((row) => row.category_key)).toEqual(["admin-ok", "owner-ok", "platform-ok"]);
  }, 60_000);
});
