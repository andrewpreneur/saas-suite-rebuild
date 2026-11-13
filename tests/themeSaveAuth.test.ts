import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { brandingThemeMarker, buildBrandingThemeJS } from "../supabase/functions/_shared/brandingTheme";
import {
  THEME_SAVE_BURST,
  THEME_SAVE_TTL_SECONDS,
  decideThemeWrite,
  highlevelEditorCanWrite,
  hostFromDomain,
  readHighlevelUser,
  signThemeSaveToken,
  supabaseBrandingEditor,
  themeSaveOriginAllowed,
  themeSaveRateLimited,
  themeGrantCoversAgency,
  themeOwnerAgencyIds,
  themeSaveTokenForScript,
  verifyThemeSaveToken,
  type ThemeWriteFacts,
} from "../supabase/functions/_shared/themeSaveAuth";

const SECRET = "theme-save-test-secret";
const AGENCY = "saassuite";

function facts(over: Partial<ThemeWriteFacts> = {}): ThemeWriteFacts {
  return {
    rateLimited: false,
    originAllowed: true,
    supabaseEditor: false,
    supabaseEmail: null,
    supabaseUserId: null,
    secretConfigured: true,
    tokenOk: true,
    ghl: "ready",
    editor: true,
    verifiedUserId: "hl-user-1",
    verifiedEmail: "owner@example.com",
    grantLocation: false,
    ...over,
  };
}

describe("theme save grants", () => {
  test("a grant is scoped to the agency and expires", async () => {
    const token = await signThemeSaveToken(AGENCY, SECRET, 1_000);
    expect(await verifyThemeSaveToken(token, SECRET, AGENCY, "loc-1", 1_000 + 10)).toBe(true);
    expect(await verifyThemeSaveToken(token, SECRET, AGENCY, "other-loc", 1_000 + 10)).toBe(true);
    expect(await verifyThemeSaveToken(token, SECRET, "other-agency", "loc-1", 1_000 + 10)).toBe(false);
    expect(await verifyThemeSaveToken(token, "other-secret", AGENCY, "loc-1", 1_000 + 10)).toBe(false);
    expect(await verifyThemeSaveToken(token, "", AGENCY, "loc-1", 1_000 + 10)).toBe(false);
    expect(await verifyThemeSaveToken(token, SECRET, AGENCY, "loc-1", 1_000 + THEME_SAVE_TTL_SECONDS)).toBe(true);
    expect(await verifyThemeSaveToken(token, SECRET, AGENCY, "loc-1", 1_000 + THEME_SAVE_TTL_SECONDS + 1)).toBe(false);
    expect(await verifyThemeSaveToken("not-a-token", SECRET, AGENCY, "loc-1")).toBe(false);
  });

  test("a sub-account save accepts this owner's grant and rejects a stale or foreign one", async () => {
    const location = "felOQsKfWXZlkBVhwhMd";
    const owner = ["saassuite", "saassuite-2", "saassuite-3"];
    const live = await signThemeSaveToken("saassuite", SECRET, 1_000);
    expect(await verifyThemeSaveToken(live, SECRET, "saassuite", location, 1_100, owner)).toBe(true);
    const sibling = await signThemeSaveToken("saassuite-2", SECRET, 1_000);
    expect(await verifyThemeSaveToken(sibling, SECRET, "saassuite", location, 1_100, owner)).toBe(true);
    expect(await verifyThemeSaveToken(sibling, SECRET, "saassuite", location, 1_100)).toBe(false);
    expect(themeGrantCoversAgency("saassuite-2", "saassuite", owner)).toBe(true);
    expect(themeGrantCoversAgency("other-agency", "saassuite", owner)).toBe(false);
    expect(themeGrantCoversAgency("saassuite-2", "other-agency", owner)).toBe(false);
    expect(themeOwnerAgencyIds("saassuite", {
      agency_id: "saassuite",
      agency_id_basic: "saassuite",
      agency_id_advanced: "saassuite-2",
      agency_id_elite: "saassuite-3",
    })).toEqual(owner);
    const foreign = await signThemeSaveToken("other-agency", SECRET, 1_000);
    expect(await verifyThemeSaveToken(foreign, SECRET, "saassuite", location, 1_100, owner)).toBe(false);
    const expired = await signThemeSaveToken("saassuite", SECRET, 1_000);
    expect(await verifyThemeSaveToken(expired, SECRET, "saassuite", location, 1_000 + THEME_SAVE_TTL_SECONDS + 1, owner)).toBe(false);
    const scoped = await signThemeSaveToken("saassuite", SECRET, 1_000, "other-location");
    expect(await verifyThemeSaveToken(scoped, SECRET, "saassuite", location, 1_100, owner)).toBe(false);
    expect(await verifyThemeSaveToken(scoped, SECRET, "saassuite", "other-location", 1_100, owner)).toBe(true);
  });

  test("a grant for one location does not open another", async () => {
    const token = await signThemeSaveToken(AGENCY, SECRET, 1_000, "loc-9");
    expect(await verifyThemeSaveToken(token, SECRET, AGENCY, "loc-9", 1_100)).toBe(true);
    expect(await verifyThemeSaveToken(token, SECRET, AGENCY, "loc-8", 1_100)).toBe(false);
    expect(themeSaveTokenForScript(token)).toBe(token);
    expect(themeSaveTokenForScript("short.sig")).toBe("");
  });

  test("the agency script embeds a real grant and ignores a forged one", async () => {
    const css = brandingThemeMarker({
      version: "v3", motion: false, iconPack: "lucide", font: "Inter", sidebarBg: "#111827", accent: "#206F2D",
    });
    const token = await signThemeSaveToken(AGENCY, SECRET, 1_000);
    const js = buildBrandingThemeJS(css, AGENCY, token);
    expect(js).toContain("theme-builder.js?v=20261106-grant");
    expect(js).toContain(`"saveToken":${JSON.stringify(token)}`);
    expect(buildBrandingThemeJS(css, AGENCY, "agency-user")).not.toContain("saveToken");
    expect(buildBrandingThemeJS(css, AGENCY)).not.toContain("saveToken");
  });
});

describe("who may write a shared theme", () => {
  test("a claimed agency role without a grant is rejected, and a missing secret does not fall open", () => {
    const forged = decideThemeWrite(facts({ tokenOk: false, editor: false, ghl: "unknown-user" }));
    expect(forged).toMatchObject({ ok: false, status: 403 });
    const missing = decideThemeWrite(facts({ secretConfigured: false, tokenOk: false, editor: false }));
    expect(missing).toEqual({ ok: false, status: 503, error: "Shared theme saves are not configured yet." });
    expect(decideThemeWrite(facts({ tokenOk: false }))).toMatchObject({ ok: false, status: 403 });
  });

  test("a signed-in owner or branding admin can save without a HighLevel grant", () => {
    const saved = decideThemeWrite(facts({
      supabaseEditor: true,
      supabaseEmail: "owner@example.com",
      supabaseUserId: "sb-1",
      secretConfigured: false,
      tokenOk: false,
      ghl: "disconnected",
      editor: false,
    }));
    expect(saved).toEqual({ ok: true, via: "supabase", userId: "sb-1", email: "owner@example.com" });
    expect(supabaseBrandingEditor({ email: "Owner@Example.com", ownerEmail: "owner@example.com", adminStatus: null, branding: null })).toBe(true);
    expect(supabaseBrandingEditor({ email: "admin@example.com", ownerEmail: "owner@example.com", adminStatus: "accepted", branding: null })).toBe(true);
    expect(supabaseBrandingEditor({ email: "admin@example.com", ownerEmail: "owner@example.com", adminStatus: "accepted", branding: "" })).toBe(true);
    expect(supabaseBrandingEditor({ email: "admin@example.com", ownerEmail: "owner@example.com", adminStatus: "accepted", branding: "view" })).toBe(false);
    expect(supabaseBrandingEditor({ email: "admin@example.com", ownerEmail: "owner@example.com", adminStatus: "accepted", branding: "none" })).toBe(false);
    expect(supabaseBrandingEditor({ email: "admin@example.com", ownerEmail: "owner@example.com", adminStatus: "pending", branding: "edit" })).toBe(false);
  });

  test("HighLevel must confirm the user, and a lookup failure stays closed", () => {
    expect(decideThemeWrite(facts())).toEqual({ ok: true, via: "highlevel", userId: "hl-user-1", email: "owner@example.com" });
    expect(decideThemeWrite(facts({ ghl: "disconnected", editor: false }))).toMatchObject({ ok: false, status: 403 });
    expect(decideThemeWrite(facts({ ghl: "down", editor: false }))).toEqual({
      ok: false,
      status: 503,
      error: "HighLevel could not confirm this user, so the shared theme was not saved.",
    });
    expect(decideThemeWrite(facts({ ghl: "unknown-user", editor: false }))).toMatchObject({ ok: false, status: 403 });
    expect(decideThemeWrite(facts({ editor: false }))).toMatchObject({ ok: false, status: 403 });
    // A confirmed non-editor stays rejected even when the location grant is present.
    expect(decideThemeWrite(facts({ editor: false, ghl: "ready", grantLocation: true }))).toMatchObject({ ok: false, status: 403 });
  });

  test("a missing user id can save with the agency grant when the location belongs to that agency", () => {
    expect(decideThemeWrite(facts({
      ghl: "unknown-user",
      editor: false,
      verifiedUserId: null,
      verifiedEmail: null,
      grantLocation: true,
    }))).toEqual({ ok: true, via: "highlevel", userId: null, email: null });
    expect(decideThemeWrite(facts({
      ghl: "unknown-user",
      editor: false,
      verifiedUserId: null,
      verifiedEmail: null,
      grantLocation: false,
    }))).toMatchObject({ ok: false, status: 403 });
    expect(decideThemeWrite(facts({
      ghl: "disconnected",
      editor: false,
      grantLocation: true,
    }))).toMatchObject({ ok: false, status: 403 });
    expect(decideThemeWrite(facts({
      tokenOk: false,
      ghl: "unknown-user",
      editor: false,
      grantLocation: true,
    }))).toMatchObject({ ok: false, status: 403 });
  });

  test("an agency user can write the agency and a location in the company; an account user cannot", () => {
    const agency = readHighlevelUser({
      user: { id: "ag-1", email: "Owner@Lynkific.com", companyId: "co-1", roles: { type: "agency", role: "admin", locationIds: [] } },
    });
    expect(agency?.email).toBe("owner@lynkific.com");
    expect(highlevelEditorCanWrite(agency, "co-1", "agency", false)).toBe(true);
    expect(highlevelEditorCanWrite(agency, "co-1", "loc-1", true)).toBe(true);
    expect(highlevelEditorCanWrite(agency, "co-1", "loc-1", false)).toBe(false);
    expect(highlevelEditorCanWrite(agency, "other-co", "loc-1", true)).toBe(false);

    const account = readHighlevelUser({ id: "ac-1", email: "rep@example.com", companyId: "co-1", type: "account", role: "user", locationIds: ["loc-1"] });
    expect(highlevelEditorCanWrite(account, "co-1", "loc-1", true)).toBe(false);

    const admin = readHighlevelUser({ id: "ad-1", companyId: "co-1", roles: { type: "account", role: "admin", locationIds: ["loc-9"] } });
    expect(highlevelEditorCanWrite(admin, "co-1", "loc-9", false)).toBe(true);
    expect(highlevelEditorCanWrite(admin, "co-1", "loc-2", true)).toBe(true);
    expect(highlevelEditorCanWrite(admin, "co-1", "loc-2", false)).toBe(false);
    expect(highlevelEditorCanWrite(admin, "co-1", "agency", true)).toBe(false);
    expect(highlevelEditorCanWrite(null, "co-1", "loc-1", true)).toBe(false);
  });

  test("origin is limited once a white-label host is known, and saves are capped", () => {
    expect(hostFromDomain("https://Lynks.Lynkific.com/app")).toBe("lynks.lynkific.com");
    expect(themeSaveOriginAllowed(null, ["lynks.lynkific.com"])).toBe(true);
    expect(themeSaveOriginAllowed("https://app.gohighlevel.com", ["lynks.lynkific.com"])).toBe(true);
    expect(themeSaveOriginAllowed("https://lynks.lynkific.com", ["lynks.lynkific.com"])).toBe(true);
    expect(themeSaveOriginAllowed("https://app.saassuite.ai", ["lynks.lynkific.com"])).toBe(true);
    expect(themeSaveOriginAllowed("http://localhost:5173", ["lynks.lynkific.com"])).toBe(true);
    expect(themeSaveOriginAllowed("https://evil.example", ["lynks.lynkific.com"])).toBe(false);
    expect(themeSaveOriginAllowed("https://evil.example", [])).toBe(true);
    expect(decideThemeWrite(facts({ originAllowed: false }))).toMatchObject({ ok: false, status: 403 });
    expect(themeSaveRateLimited(THEME_SAVE_BURST - 1)).toBe(false);
    expect(themeSaveRateLimited(THEME_SAVE_BURST)).toBe(true);
    expect(decideThemeWrite(facts({ rateLimited: true, supabaseEditor: true }))).toMatchObject({ ok: false, status: 429 });
  });

  test("the customizer reads the logged-in HighLevel user from the page", () => {
    const src = readFileSync(new URL("../public/theme-builder.js", import.meta.url), "utf8");
    expect(src).toContain("AppUtils");
    expect(src).toContain("getCurrentUser");
    expect(src).toContain("getCompany");
    expect(src).toContain("separatePlace");
    expect(src).toContain("discoverUser");
    expect(src).toContain("refreshSaveGrant");
    expect(src).toContain("grantState");
  });
});
