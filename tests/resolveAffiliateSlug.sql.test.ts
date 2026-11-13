import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL("../supabase/migrations/20261027150000_resolve_affiliate_slug.sql", import.meta.url),
  "utf8",
);

const andy = "7e9ace3b-1111-4111-8111-111111111111";
const other = "15e6d7bf-3e08-4974-a8b5-8e6217382f39";

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.affiliates (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      full_name text,
      status text DEFAULT 'PENDING',
      affiliate_slug text UNIQUE,
      commission_rate numeric(5,2) NOT NULL DEFAULT 30
    );
    ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.affiliates FORCE ROW LEVEL SECURITY;
    GRANT SELECT ON public.affiliates TO anon, authenticated;
    CREATE POLICY "Affiliates can view own application"
      ON public.affiliates FOR SELECT TO authenticated
      USING (lower(email) = 'owner@example.com');
    INSERT INTO public.affiliates (id, email, full_name, status, affiliate_slug, commission_rate)
    VALUES
      ('${andy}', 'contact@sololink.io', 'Andy Griffith', 'APPROVED', 'andy-griffith', 30),
      ('${other}', 'hidden@example.com', 'Hidden Rate', 'APPROVED', 'russel', 70);
  `);
  await db.exec(migration);
  return db;
}

test("anonymous visitors resolve a slug to an id and cannot read affiliate rows", async () => {
  const db = await fixture();
  await db.exec("SET ROLE anon;");
  const rows = await db.query("SELECT id, email, commission_rate FROM public.affiliates");
  expect(rows.rows).toEqual([]);
  const resolved = await db.query<{ resolve_affiliate_slug: string }>(
    "SELECT public.resolve_affiliate_slug('andy-griffith')",
  );
  expect(resolved.rows[0]?.resolve_affiliate_slug).toBe(andy);
  const spaced = await db.query<{ resolve_affiliate_slug: string }>(
    "SELECT public.resolve_affiliate_slug('  Andy-Griffith  ')",
  );
  expect(spaced.rows[0]?.resolve_affiliate_slug).toBe(andy);
  const missing = await db.query<{ resolve_affiliate_slug: string | null }>(
    "SELECT public.resolve_affiliate_slug('not-a-real-slug')",
  );
  expect(missing.rows[0]?.resolve_affiliate_slug).toBeNull();
  const blank = await db.query<{ resolve_affiliate_slug: string | null }>(
    "SELECT public.resolve_affiliate_slug('   ')",
  );
  expect(blank.rows[0]?.resolve_affiliate_slug).toBeNull();
  await db.close();
});

test("a signed-in visitor who is not that affiliate still resolves the slug", async () => {
  const db = await fixture();
  await db.exec("SET ROLE authenticated;");
  const rows = await db.query("SELECT id FROM public.affiliates");
  expect(rows.rows).toEqual([]);
  const resolved = await db.query<{ resolve_affiliate_slug: string }>(
    "SELECT public.resolve_affiliate_slug('andy-griffith')",
  );
  expect(resolved.rows[0]?.resolve_affiliate_slug).toBe(andy);
  await db.close();
});

test("the lookup stays a slug-to-id function and does not touch rates or signup", async () => {
  expect(migration).not.toMatch(/commission_rate/);
  expect(migration).not.toMatch(/register_starter_user/);
  expect(migration).not.toMatch(/CREATE POLICY/i);
  const db = await fixture();
  const defs = await db.query<{ nsp: string; definer: boolean; result: string }>(`
    SELECT n.nspname AS nsp, p.prosecdef AS definer, pg_get_function_result(p.oid) AS result
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'resolve_affiliate_slug'
    ORDER BY n.nspname
  `);
  expect(defs.rows).toEqual([
    { nsp: "private", definer: true, result: "uuid" },
    { nsp: "public", definer: false, result: "uuid" },
  ]);
  const body = await db.query<{ def: string }>(
    "SELECT pg_get_functiondef('private.resolve_affiliate_slug(text)'::regprocedure) AS def",
  );
  expect(body.rows[0]?.def).not.toMatch(/commission_rate/);
  expect(body.rows[0]?.def).not.toMatch(/\bemail\b/);
  await db.close();
});
