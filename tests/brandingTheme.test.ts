import { describe, test, expect } from "bun:test";
import { accentInk, brandingThemeMarker, cachedThemeScriptNeedsFreshGrant, embeddedThemeGrantExpiry, readBrandingTheme, buildBrandingThemeJS, themeUserCaptureJS, keystoneLaunchpadIcon, KEYSTONE_LAUNCHPAD_ICON } from "../supabase/functions/_shared/brandingTheme";
import { THEME_GRANT_REFRESH_MARGIN_SECONDS, signThemeSaveToken } from "../supabase/functions/_shared/themeSaveAuth";
import { splitBrandingCSS, updateBrandingPart } from "../src/lib/brandingSections";

describe("Shared branding versions", () => {
  test("runtime is injected once, reconfigured when present, and retryable after a failed load", () => {
    const css = brandingThemeMarker({ version: "v3", motion: true, iconPack: "lucide", font: "Roboto", sidebarBg: "#FAFAF8", accent: "#206F2D" });
    const js = buildBrandingThemeJS(css, "agency-one");
    const scripts: Array<{ onerror?: () => void; remove: () => void }> = [];
    const win: { SAI_THEME_CONFIG?: unknown; SAITheme?: { configure: (config: any) => void } } = {};
    const doc = { querySelector: () => scripts[0] || null, createElement: () => {
      const script = { setAttribute: () => {}, remove: () => { scripts.splice(scripts.indexOf(script), 1); }, onerror: undefined as (() => void) | undefined };
      return script;
    }, head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) } };
    const run = new Function("window", "document", js);
    run(win, doc); run(win, doc);
    expect(scripts).toHaveLength(1);
    scripts[0]?.onerror?.();
    expect(scripts).toHaveLength(0);
    run(win, doc);
    expect(scripts).toHaveLength(1);
    let version = "";
    win.SAITheme = { configure: config => { version = config.brandingVersion; } };
    run(win, doc);
    expect(version).toBe("v3");
    expect(scripts).toHaveLength(1);
  });
  for (const version of ["v1", "v2", "v3"] as const) {
    test(`${version} retains shared icons and motion settings`, () => {
      const css = brandingThemeMarker({ version, motion: false, iconPack: "tabler", font: "Roboto", sidebarBg: "#FAFAF8", accent: "#206F2D" });
      expect(readBrandingTheme(css)).toEqual({ version, motion: false, iconPack: "tabler", font: "Roboto", sidebarBg: "#FAFAF8", accent: "#206F2D" });
      const js = buildBrandingThemeJS(css, "agency-one");
      expect(js).toContain(`"brandingVersion":"${version}"`);
      expect(js).toContain('"motion":false');
      expect(js).toContain('"iconPack":"tabler"');
    });
  }
  test("a blue highlight gets light text", () => {
    expect(accentInk("#2F6FED")).toBe("#FFFFFF");
    expect(accentInk("#D4A72C")).toBe("#111827");
    const css = brandingThemeMarker({ version: "v2", motion: false, iconPack: "default", font: "Inter", sidebarBg: "#0f172a", accent: "#2F6FED" });
    expect(buildBrandingThemeJS(css, "saassuite")).toContain('"accentText":"#FFFFFF"');
    expect(buildBrandingThemeJS(css, "saassuite")).toContain("theme-builder.js?v=20261112-switchyard");
  });
  test("switching sidebar replaces old branding without removing independent sections", () => {
    const old = updateBrandingPart(updateBrandingPart("", "login", "login-css"), "sidebar", "v1-css");
    const next = updateBrandingPart(old, "sidebar", "v3-css");
    expect(splitBrandingCSS(next)).toEqual({ sidebar: "v3-css", login: "login-css", buttons: "" });
    expect(splitBrandingCSS(old).sidebar).toBe("v1-css");
  });
  test("invalid theme values cannot generate runtime settings", () => {
    expect(buildBrandingThemeJS('/* SS-THEME:{"version":"v3","sidebarBg":"red","accent":"blue"} */', "agency-one")).toBe("");
  });
  test("a filled HighLevel user becomes an admin-scoped customizer, and a blank tag stays open", () => {
    const css = brandingThemeMarker({ version: "v3", motion: true, iconPack: "lucide", font: "Roboto", sidebarBg: "#111827", accent: "#206F2D" });
    const js = buildBrandingThemeJS(css, "agency-one");
    const run = (user?: Record<string, string>) => {
      const win: { __SS_THEME_USER?: unknown; SAI_THEME_CONFIG?: { builderAccess?: string; user?: { id?: string; companyId?: string } } } = {};
      if (user) win.__SS_THEME_USER = user;
      new Function("window", "document", js)(win, { querySelector: () => ({}), createElement: () => ({ setAttribute() {}, remove() {} }), head: { appendChild() {} } });
      return win.SAI_THEME_CONFIG;
    };
    const identified = run({ type: "account", role: "admin", email: "a@b.co", id: "user-1", companyId: "co-1" });
    expect(identified?.builderAccess).toBe("admins");
    expect(identified?.user).toMatchObject({ id: "user-1", companyId: "co-1" });
    expect(run()?.builderAccess).toBe("all");
    expect(run({ type: "{{user.type}}", role: "", email: "", id: "", companyId: "" })?.builderAccess).toBe("all");
  });
  test("the install tag is read synchronously and unfilled merge fields are dropped", () => {
    const attrs: Record<string, string> = {
      "data-user-type": "agency",
      "data-user-role": "{{user.role}}",
      "data-user-email": "owner@example.com",
      "data-user-id": "u-9",
      "data-company-id": "company-1",
    };
    const win: { __SS_THEME_USER?: { type: string; role: string; email: string; id: string; companyId: string } } = {};
    const doc = { currentScript: { getAttribute: (name: string) => attrs[name] || "" } };
    new Function("window", "document", themeUserCaptureJS())(win, doc);
    expect(win.__SS_THEME_USER).toEqual({ type: "agency", role: "", email: "owner@example.com", name: "", id: "u-9", companyId: "company-1" });
    attrs["data-user-name"] = "Ada Owner";
    const named: { __SS_THEME_USER?: { name: string; email: string } } = {};
    new Function("window", "document", themeUserCaptureJS())(named, doc);
    expect(named.__SS_THEME_USER).toMatchObject({ name: "Ada Owner", email: "owner@example.com" });
    const late: { __SS_THEME_USER?: { id: string; type: string } } = {};
    const tag = { src: "https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=demo&type=js", getAttribute: (name: string) => attrs[name] || "" };
    new Function("window", "document", themeUserCaptureJS())(late, { currentScript: null, getElementsByTagName: () => [tag] });
    expect(late.__SS_THEME_USER).toMatchObject({ id: "u-9", type: "agency" });
  });
});

describe("Keystone Launchpad icon", () => {
  const css = brandingThemeMarker({
    version: "v3", motion: true, iconPack: "lucide", font: "Inter", sidebarBg: "#ffffff", accent: "#fc2145",
  });
  const themeOf = (agencyId: string) => {
    const win: { SAI_THEME_CONFIG?: { agencyTheme?: { iconPack?: string; icons?: Record<string, string> } } } = {};
    new Function("window", "document", buildBrandingThemeJS(css, agencyId))(win, {
      querySelector: () => ({}),
      createElement: () => ({ setAttribute() {}, remove() {} }),
      head: { appendChild() {} },
    });
    return win.SAI_THEME_CONFIG?.agencyTheme;
  };

  test("Keystone hubs get a lightning bolt and every other agency keeps an empty icon map", () => {
    expect(KEYSTONE_LAUNCHPAD_ICON).toBe("lucide:zap");
    for (const id of ["keystone", "keystone-2", "keystone-3", "LWQoHTpjYvZD7t9LEd1u", "agency-keystone"]) {
      expect(keystoneLaunchpadIcon(id)).toBe("lucide:zap");
      const theme = themeOf(id);
      expect(theme?.iconPack).toBe("lucide");
      expect(theme?.icons).toEqual({ launchpad: "lucide:zap" });
    }
    expect(keystoneLaunchpadIcon("agency-one")).toBeNull();
    expect(keystoneLaunchpadIcon("keystone-extra")).toBeNull();
    expect(themeOf("agency-one")?.icons).toEqual({});
    expect(buildBrandingThemeJS(css, "agency-one")).not.toContain("lucide:zap");
  });
});

describe("cached theme grant", () => {
  const css = brandingThemeMarker({
    version: "v1", motion: true, iconPack: "lucide", font: "Inter", sidebarBg: "#ffffff", accent: "#3d54ff",
  });

  test("a theme script with a missing or expiring grant is rebuilt, and a live one is served", async () => {
    const now = 1_800_000_000;
    const bare = buildBrandingThemeJS(css, "saassuite");
    expect(bare).toContain("theme-builder.js?v=");
    expect(cachedThemeScriptNeedsFreshGrant(bare, now)).toBe(true);
    expect(cachedThemeScriptNeedsFreshGrant("/* no theme runtime */", now)).toBe(false);
    const fresh = await signThemeSaveToken("saassuite", "theme-save-test-secret", now);
    const live = buildBrandingThemeJS(css, "saassuite", fresh);
    expect(embeddedThemeGrantExpiry(live)).toBe(now + 2 * 60 * 60);
    expect(cachedThemeScriptNeedsFreshGrant(live, now)).toBe(false);
    expect(cachedThemeScriptNeedsFreshGrant(live, now + 2 * 60 * 60 - THEME_GRANT_REFRESH_MARGIN_SECONDS + 1)).toBe(true);
    const expired = await signThemeSaveToken("saassuite", "theme-save-test-secret", now - 3 * 60 * 60);
    expect(cachedThemeScriptNeedsFreshGrant(buildBrandingThemeJS(css, "saassuite", expired), now)).toBe(true);
  });
});