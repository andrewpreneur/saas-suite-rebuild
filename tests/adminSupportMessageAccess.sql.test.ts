import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const directory = new URL("../supabase/migrations/", import.meta.url);
const file = readdirSync(directory).find((name) => {
  return readFileSync(new URL(name, directory), "utf8").includes("Admin Support message timeout correction");
});
const policy = file ? readFileSync(new URL(file, directory), "utf8") : `
CREATE POLICY "Agency owners can view ai chat messages" ON ai_chat_messages FOR SELECT
USING ((can_access_agency(agency_id) AND support_can_see_chat(agency_id,user_identifier))
OR lower(user_identifier)=current_auth_email());`;

const setup = `
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE FUNCTION current_auth_email() RETURNS text LANGUAGE sql STABLE AS $$
SELECT coalesce(current_setting('test.email', true), '') $$;
CREATE FUNCTION is_platform_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT current_auth_email() IN ('andrew@dna-media.net','team@yoursoftwareonboarding.com') $$;
CREATE FUNCTION platform_support_agency_key(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT nullif(lower(regexp_replace(btrim(coalesce($1,'')), 'NO$', '', 'i')), '') $$;
CREATE FUNCTION can_access_agency(text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
BEGIN
IF is_platform_admin() THEN RETURN true; END IF;
RETURN $1='owner-agency' AND current_auth_email()='owner@example.com';
END $$;
CREATE FUNCTION support_can_see_chat(text,text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
BEGIN
IF is_platform_admin() THEN RAISE EXCEPTION 'slow per-message platform exclusion check'; END IF;
RETURN $2<>'assigned-to-other@example.com';
END $$;
CREATE TABLE saas_suite_users(email text,agency_id text,agency_id_basic text,agency_id_advanced text,agency_id_elite text);
CREATE TABLE platform_support_excluded_agencies(owner_email text);
CREATE TABLE ai_chat_messages(id integer,agency_id text,user_identifier text,created_at timestamptz);
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ai_chat_messages,saas_suite_users,platform_support_excluded_agencies TO authenticated,anon;
INSERT INTO saas_suite_users VALUES ('excluded@example.com','excluded','excluded','excluded-2','excluded-3');
INSERT INTO platform_support_excluded_agencies VALUES ('excluded@example.com');
INSERT INTO ai_chat_messages VALUES
(1,'champagne-room','deborah@deborahcarlislesolomon.com',now()),
(2,'excluded-2NO','customer@example.com',now()),
(3,'owner-agency','customer@example.com',now()),
(4,'owner-agency','assigned-to-other@example.com',now()),
(5,'unrelated','OWNER@EXAMPLE.COM',now());
`;

async function ids(email: string, query = "SELECT id FROM ai_chat_messages ORDER BY id", role = "authenticated") {
  const db = new PGlite();
  try {
    await db.exec(setup);
    await db.exec(policy);
    await db.query("SELECT set_config('test.email',$1,false)", [email]);
    await db.exec(`SET ROLE ${role}`);
    return (await db.query<{ id: number }>(query)).rows.map((row) => row.id);
  } finally {
    await db.close();
  }
}

test("Deborah's latest ten messages bypass per-row platform exclusion checks", async () => {
  expect(await ids("andrew@dna-media.net", "SELECT id FROM ai_chat_messages WHERE agency_id='champagne-room' AND user_identifier ILIKE 'deborah@deborahcarlislesolomon.com' ORDER BY created_at DESC LIMIT 10")).toEqual([1]);
});
test("platform admin cannot read excluded agency messages", async () => {
  expect(await ids("andrew@dna-media.net")).toEqual([1,3,4,5]);
  expect(await ids("team@yoursoftwareonboarding.com")).toEqual([1,3,4,5]);
});
test("agency owner keeps agency permissions and own case-insensitive transcript", async () => {
  expect(await ids("owner@example.com")).toEqual([3,5]);
});
test("unrelated signed-in user cannot read customer transcripts", async () => {
  expect(await ids("stranger@example.com")).toEqual([]);
});
test("anonymous visitor cannot read customer transcripts", async () => {
  expect(await ids("", undefined, "anon")).toEqual([]);
});