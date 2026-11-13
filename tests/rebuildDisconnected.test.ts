import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isBlockedHost } from "../src/lib/backendDisconnected";

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx|js|mjs|html|json|css)$/.test(name)) out.push(path);
  }
  return out;
}

const LIVE = /[a-z0-9]{20}\.supabase\.co|auth\.saassuite\.ai|eyJhbGciOiJIUzI1NiIs|sb_publishable_|sb_secret_/;

test("no live backend address or key is left in the app, page shell, public files or env", () => {
  const scanned = [...files("src"), ...files("public"), "index.html", ".env"];
  const hits = scanned.filter((path) => LIVE.test(readFileSync(path, "utf8")));
  expect(hits).toEqual([]);
});

test("the Supabase client is always the local mock", () => {
  const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
  expect(client).toContain("createPlatformMockClient()");
  expect(client).not.toContain("createClient(");
  expect(readFileSync("src/lib/platformMock.ts", "utf8")).toContain("export const platformMockEnabled = true;");
});

test("the network guard refuses live services and allows everything else", () => {
  for (const host of ["abc.supabase.co", "auth.saassuite.ai", "px.lspxl.com", "www.googletagmanager.com", "connect.facebook.net", "backend-disconnected.invalid"])
    expect(isBlockedHost(host)).toBe(true);
  for (const host of ["localhost", "127.0.0.1", "21st.dev", "fonts.gstatic.com"]) expect(isBlockedHost(host)).toBe(false);
});

test("the page shell opts out of tracking before anything else loads, with no Ospry tag", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain("window.__ssTrackingOptOut = true;");
  expect(html).not.toContain("px.lspxl.com");
});
