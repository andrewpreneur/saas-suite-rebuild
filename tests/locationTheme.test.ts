import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import {
  claimedThemeEditor,
  hintUserEmail,
  hintUserId,
  sanitizeLocationTheme,
} from "../supabase/functions/_shared/locationTheme";
import { installSnippets } from "../src/lib/installSnippets";
import { HIGHLEVEL_USER_ATTRS } from "../supabase/functions/_shared/menuRemovalGuide";

describe("shared location themes", () => {
  test("keeps a theme and records only a plausible user hint", () => {
    expect(sanitizeLocationTheme({
      sidebarBg: "#112233",
      accent: "#abcdef",
      logoUrl: "https://cdn.example.com/logo.png",
      logoHeight: 48,
      name: "Night",
      icons: { dashboard: "lucide:house", bad: "<script>" },
      ghlDefault: false,
    })).toMatchObject({ sidebarBg: "#112233", accent: "#ABCDEF", logoHeight: 48, name: "Night" });
    expect(sanitizeLocationTheme({ ghlDefault: true })).toEqual({ ghlDefault: true });
    expect(sanitizeLocationTheme({ inheritAgency: true, sidebarBg: "#112233" })).toEqual({ inheritAgency: true });
    expect(sanitizeLocationTheme({ logoUrl: "javascript:alert(1)" })).toBeNull();
    expect(claimedThemeEditor("agency", "user")).toBe(true);
    expect(claimedThemeEditor("account", "admin")).toBe(true);
    expect(claimedThemeEditor("account", "user")).toBe(false);
    expect(claimedThemeEditor("{{user.type}}", "{{user.role}}")).toBe(false);
    expect(hintUserId("user_1")).toBe("user_1");
    expect(hintUserId("{{user.id}}")).toBeNull();
    expect(hintUserEmail("Owner@Example.com")).toBe("owner@example.com");
    expect(hintUserEmail("not-an-email")).toBeNull();
  });

  test("the install tag and the customizer agree on the user fields", () => {
    const js = installSnippets("demo-agency").js;
    expect(js).toContain(HIGHLEVEL_USER_ATTRS);
    expect(js).toContain("agency_id=demo-agency&type=js");
    const src = readFileSync(new URL("../public/theme-builder.js", import.meta.url), "utf8");
    expect(src).toContain("Theme Customizer (Beta)");
    expect(src).toContain("The full release is November 1st.");
    expect(src).toContain("functions/v1/location-theme");
    expect(src).toContain("saveToken: CFG.saveToken || \"\"");
    expect(src).toContain("data-sai-contrast");
    expect(src).toContain("sai-quiet-page");
    expect(src).toContain("media-storage");
  });
});
