import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/20261103143508_cc601802-0372-48b6-8f01-c36599cd094c.sql', import.meta.url), 'utf8');
const userId = '00000000-0000-0000-0000-000000000001';
const learnerId = '00000000-0000-0000-0000-000000000002';
const otherId = '00000000-0000-0000-0000-000000000003';
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid, email text);
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
    CREATE TABLE saas_suite_users(id bigint, email text, agency_id text, agency_id_basic text, agency_id_advanced text, agency_id_elite text, original_agency_id text, original_agency_id_basic text, original_agency_id_advanced text, original_agency_id_elite text);
    CREATE TABLE user_progress(id uuid, agency_id text);
    CREATE TABLE base_calls(user_id uuid);
    CREATE FUNCTION cleanup_account_for_deletion(uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO base_calls VALUES($1) $$;
    INSERT INTO auth.users VALUES('${userId}','owner@example.com');
    INSERT INTO saas_suite_users(id,email,agency_id) VALUES(1,'owner@example.com','owned'),(2,'other@example.com','other');
    INSERT INTO user_progress VALUES('${learnerId}','owned'),('${otherId}','other');
    SET test.role='service_role';`);
  const tables = [...migration.matchAll(/DELETE FROM public\.(\w+)/g)].map(m => m[1]);
  for (const table of new Set(tables)) {
    await db.exec(`CREATE TABLE ${table}(id uuid, agency_id text, user_id uuid, entry_id uuid, email text, owner_email text, claimed_by text, user_email text, auth_user_id uuid, saas_suite_user_id bigint, contact_email text);
      INSERT INTO ${table}(id,agency_id,user_id,entry_id,email,owner_email,claimed_by,user_email,auth_user_id,saas_suite_user_id,contact_email) VALUES
      ('${learnerId}','owned','${userId}','${learnerId}','owner@example.com','owner@example.com','owner@example.com','owner@example.com','${userId}',1,'owner@example.com'),
      ('${otherId}','other','${otherId}','${otherId}','other@example.com','other@example.com','other@example.com','other@example.com','${otherId}',2,'other@example.com');`);
  }
  await db.exec(migration);
  return { db, tables };
}
test('deletion removes newer account data and learner history without deleting another account data', async () => {
  const { db, tables } = await fixture();
  await db.exec(`UPDATE module_completion SET user_id='${learnerId}' WHERE agency_id='owned'; SELECT cleanup_account_for_deletion('${userId}');`);
  for (const table of new Set(tables)) {
    expect((await db.query(`SELECT agency_id FROM ${table}`)).rows).toEqual([{ agency_id: 'other' }]);
  }
  expect((await db.query('SELECT user_id FROM base_calls')).rows).toEqual([{ user_id: userId }]);
  await db.close();
});
test('shared identifiers block cleanup before any account data is removed', async () => {
  const { db } = await fixture();
  await db.exec("UPDATE saas_suite_users SET agency_id='owned' WHERE id=2;");
  await expect(db.query(`SELECT cleanup_account_for_deletion('${userId}')`)).rejects.toThrow('Shared workspace identifiers');
  expect((await db.query('SELECT * FROM module_completion')).rows).toHaveLength(2);
  expect((await db.query('SELECT * FROM base_calls')).rows).toHaveLength(0);
  await db.close();
});
test('non-service callers cannot run irreversible cleanup', async () => {
  const { db } = await fixture();
  await db.exec("SET test.role='authenticated';");
  await expect(db.query(`SELECT cleanup_account_for_deletion('${userId}')`)).rejects.toThrow('Not authorized');
  expect((await db.query('SELECT * FROM module_completion')).rows).toHaveLength(2);
  await db.close();
});