import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20261026042313_45386fa3-ba5e-4aa4-b966-cf82eb50e4ef.sql",
  "20261026042333_2c4b7d47-f7b3-4367-88a5-7889b7a1d9a0.sql",
  "20261026042559_1df18aa6-ce7b-4b8f-a88d-a0ed84f22ece.sql",
].map(name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
const entry = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${user}'::uuid $$;
    CREATE FUNCTION public.current_auth_email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.email',true) $$;
    CREATE TABLE giveaway_entries(id uuid PRIMARY KEY,email text,agency_id text,opted_in_at timestamptz,points int,tickets int,last_scored_at timestamptz,breakdown jsonb,updated_at timestamptz);
    GRANT SELECT ON giveaway_entries TO authenticated;
    ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON giveaway_entries FOR SELECT TO authenticated USING(email=current_auth_email());
    CREATE TABLE account_admins(owner_email text,admin_email text,status text);
    GRANT SELECT ON account_admins TO authenticated;
    CREATE TABLE saas_suite_users(email text,agency_id text,agency_id_basic text,agency_id_advanced text,agency_id_elite text);
    CREATE TABLE user_progress(id uuid,agency_id text,name text,created_at timestamptz);
    CREATE TABLE module_completion(id uuid,user_id uuid,module_id text,completed boolean,completed_at timestamptz);
    CREATE TABLE user_onboarding_checklist_completion(agency_id text,completed_at timestamptz);
    CREATE TABLE platform_events(agency_id text,user_email text,trigger_type text,created_at timestamptz);
    CREATE TABLE slack_workspace_links(agency_id text,agency_ids text[],created_at timestamptz);
    INSERT INTO giveaway_entries(id,email,agency_id,opted_in_at) VALUES('${entry}','owner@example.com','agency','2026-10-01');
    INSERT INTO saas_suite_users(email,agency_id,agency_id_basic) VALUES('owner@example.com','agency','agency');
    INSERT INTO user_progress VALUES('${user}','agency','Test learner','2026-10-02');
    INSERT INTO module_completion SELECT md5(n::text)::uuid,'${user}',n::text,true,'2026-10-05 12:00:00Z'::timestamptz + n*interval '2 seconds' FROM generate_series(1,10) n;
    INSERT INTO module_completion VALUES(md5('slow')::uuid,'${user}','slow',true,'2026-10-06');
  `);
  for (const sql of migrations) await db.exec(sql);
  return db;
}
async function review(db: PGlite) {
  await db.exec(`INSERT INTO challenge_point_reviews(entry_id,user_id,user_name,completion_ids,module_ids,started_at,ended_at,reason) SELECT entry_id,user_id,user_name,completion_ids,module_ids,started_at,ended_at,'rapid marks' FROM challenge_suspicious_bursts('2026-09-26','2026-10-26');`);
}
test("rapid burst audit captures ten two-second completion marks, not a later isolated completion", async () => {
  const db = await fixture();
  const result = await db.query<{ points: number }>("SELECT cardinality(completion_ids) points FROM challenge_suspicious_bursts('2026-09-26','2026-10-26')");
  expect(result.rows).toEqual([{ points: 10 }]);
  await db.close();
});
test("deductions survive repeat scoring without deleting progress or net-new user points", async () => {
  const db = await fixture();
  await review(db);
  await db.exec("SELECT giveaway_recalculate('owner@example.com'); SELECT giveaway_recalculate('owner@example.com');");
  const result = await db.query<{ points: number; modules: number }>("SELECT points,(breakdown->>'module_completions')::int modules FROM giveaway_entries");
  expect(result.rows).toEqual([{ points: 2, modules: 1 }]);
  const progress = await db.query<{ total: number }>("SELECT count(*)::int total FROM module_completion WHERE completed");
  expect(progress.rows[0]?.total).toBe(11);
  await db.close();
});
test("private evidence is owner-only through both the table and the retrieval function", async () => {
  const db = await fixture(); await review(db);
  await db.exec("SET ROLE authenticated; SET test.email='owner@example.com';");
  expect((await db.query("SELECT * FROM challenge_my_point_reviews('owner@example.com')")).rows).toHaveLength(1);
  await db.exec("SET test.email='other@example.com';");
  expect((await db.query("SELECT * FROM challenge_point_reviews")).rows).toHaveLength(0);
  expect((await db.query("SELECT * FROM challenge_my_point_reviews('owner@example.com')")).rows).toHaveLength(0);
  await db.exec("RESET ROLE; SET ROLE anon;");
  await expect(db.query("SELECT * FROM challenge_my_point_reviews('owner@example.com')")).rejects.toThrow(/permission denied/);
  await db.close();
});
test("reviewed scoring keeps the existing October 26 04:59 UTC cutoff", async () => {
  const db = await fixture();
  await db.exec(`INSERT INTO module_completion VALUES(md5('past-cutoff')::uuid,'${user}','late',true,'2026-10-26 05:00:00Z'); SELECT giveaway_recalculate('owner@example.com');`);
  const result = await db.query<{ points: number }>("SELECT points FROM giveaway_entries");
  expect(result.rows[0]?.points).toBe(12);
  await db.close();
});