import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS } from "../supabase/functions/_shared/platformAdmins";

const migration = readFileSync(
  new URL("../supabase/migrations/20261109053000_platform_admin_allowlist.sql", import.meta.url),
  "utf8",
);

function functionBody(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const dollar = migration.indexOf("$$", start);
  const closer = migration.startsWith("$function$", dollar) ? "$function$;" : "$$;";
  const end = migration.indexOf(closer, dollar);
  expect(end).toBeGreaterThan(dollar);
  return migration.slice(start, end + closer.length);
}

test("shared allowlist matches the database function", () => {
  expect([...PLATFORM_ADMIN_EMAILS]).toEqual([
    "andrew@dna-media.net",
    "team@yoursoftwareonboarding.com",
  ]);
  expect(isPlatformAdminEmail("Andrew@DNA-MEDIA.NET")).toBe(true);
  expect(isPlatformAdminEmail("  team@yoursoftwareonboarding.com  ")).toBe(true);
  expect(isPlatformAdminEmail("rendersgallery0@gmail.com")).toBe(false);
  expect(isPlatformAdminEmail("team@yoursoftwareonboarding.com.evil")).toBe(false);
  expect(isPlatformAdminEmail(null)).toBe(false);

  const fn = functionBody("is_platform_admin");
  expect(fn).toContain("RETURNS boolean");
  expect(fn).toContain("LANGUAGE sql");
  expect(fn).toContain("STABLE");
  expect(fn).toContain("SECURITY DEFINER");
  expect(fn).toContain("SET search_path = public");
  for (const email of PLATFORM_ADMIN_EMAILS) expect(fn).toContain(`'${email}'`);
  expect(migration).not.toContain("DROP POLICY IF EXISTS \"Agency owners can read chat threads\"");
  expect(migration).not.toContain("DROP POLICY IF EXISTS \"Agency owners can view support tickets\"");
  expect(functionBody("get_ticket_replies_for_staff")).toContain("public.is_platform_admin()");
  expect(functionBody("get_ticket_replies_for_staff")).not.toContain("andrew@dna-media.net");
});

test("is_platform_admin is true only for the allowlist", async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE FUNCTION public.current_auth_email() RETURNS text
    LANGUAGE sql STABLE AS $$
      SELECT lower(coalesce(current_setting('test.email', true), ''))
    $$;
  `);
  await db.exec(functionBody("is_platform_admin"));

  async function allowed(email: string) {
    await db.query(`SELECT set_config('test.email', $1, false)`, [email]);
    const result = await db.query<{ ok: boolean }>("SELECT public.is_platform_admin() AS ok");
    return result.rows[0].ok;
  }

  expect(await allowed("andrew@dna-media.net")).toBe(true);
  expect(await allowed("Andrew@DNA-MEDIA.NET")).toBe(true);
  expect(await allowed("team@yoursoftwareonboarding.com")).toBe(true);
  expect(await allowed("Team@YourSoftwareOnboarding.com")).toBe(true);
  expect(await allowed("")).toBe(false);
  expect(await allowed("owner@agency.example")).toBe(false);
  expect(await allowed("andrew@dna-media.net.evil.example")).toBe(false);
  expect(await allowed("rendersgallery0@gmail.com")).toBe(false);
  await db.close();
});
