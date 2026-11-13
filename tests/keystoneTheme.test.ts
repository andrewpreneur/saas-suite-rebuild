import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { resolveTopNavWidgetColor } from "../supabase/functions/_shared/topNavWidgetColor";
import { popupHostUserRuntimeJS, trustedPopupHostUser } from "../supabase/functions/_shared/popupHostIdentity";
import { logoSlotCSS } from "../supabase/functions/dynamic-styles/logo-slot";
import { buildTopNavWidgetJS } from "../supabase/functions/dynamic-styles/top-nav-widget";

const keystone = { primary: "#fc2145", secondary: "#ffffff", tertiary: null as string | null };

describe("Help widget colors", () => {
  test("a missing tertiary uses secondary white instead of the primary button color", () => {
    expect(resolveTopNavWidgetColor("tertiary", null, keystone, "#d4a843")).toBe("#ffffff");
    expect(resolveTopNavWidgetColor("primary", null, keystone, "#1d1d1f")).toBe("#fc2145");
    expect(resolveTopNavWidgetColor("custom", "#fc2145", keystone, "#1d1d1f")).toBe("#fc2145");
  });

  test("an explicit tertiary wins, and a missing secondary tertiary stays white", () => {
    expect(resolveTopNavWidgetColor("tertiary", null, { ...keystone, tertiary: "#111111" }, "#d4a843")).toBe("#111111");
    expect(resolveTopNavWidgetColor("secondary", null, keystone, "#d4a843")).toBe("#ffffff");
    expect(resolveTopNavWidgetColor("tertiary", null, { primary: "#fc2145", secondary: null, tertiary: null }, "#d4a843")).toBe("#ffffff");
  });
});

describe("trusted HighLevel identity", () => {
  const read = (user: Record<string, string> | null) => {
    const win = { __SS_THEME_USER: user };
    return new Function("window", `${popupHostUserRuntimeJS()}\nreturn ssPopupHostUser();`)(win);
  };

  test("email, or id plus name, is enough to skip login", () => {
    expect(trustedPopupHostUser({ email: "owner@keystone.test" })).toEqual({ email: "owner@keystone.test" });
    expect(trustedPopupHostUser({ id: "user_1", name: "Ada Owner" })).toEqual({ id: "user_1", name: "Ada Owner" });
    expect(read({ email: "owner@keystone.test", id: "", name: "" })).toEqual({ email: "owner@keystone.test" });
    expect(read({ id: "user_1", name: "Ada Owner", email: "" })).toEqual({ id: "user_1", name: "Ada Owner" });
  });

  test("a name alone, an id alone, or an unfilled merge field stays on the login screen", () => {
    expect(trustedPopupHostUser({ name: "Ada Owner" })).toBeNull();
    expect(trustedPopupHostUser({ id: "user_1" })).toBeNull();
    expect(trustedPopupHostUser({ email: "{{user.email}}", name: "{{user.name}}" })).toBeNull();
    expect(trustedPopupHostUser({ id: "user<script>", name: "Ada" })).toBeNull();
    expect(read(null)).toBeNull();
    expect(read({ name: "Ada Owner" })).toBeNull();
    expect(read({ email: "{{user.email}}" })).toBeNull();
  });
});

describe("top-nav embed is not the bottom-right launcher", () => {
  test("the widget asks the hub for a top-nav host and passes identity only in the message", () => {
    const js = buildTopNavWidgetJS("Help & Support", "#fc2145", {
      agencyId: "keystone",
      iconColor: "#ffffff",
    });
    expect(js).toContain("host=top-nav");
    expect(js).toContain("host: 'top-nav'");
    expect(js).toContain("function ssPopupHostUser()");
    expect(js).not.toContain("popup is not enabled");
    expect(js).not.toContain("user.email=");
  });

  test("the floating launcher stays behind popup_enabled and does not mark itself as top-nav", () => {
    const source = readFileSync("supabase/functions/dynamic-styles/index.ts", "utf8");
    const launcher = source.slice(source.indexOf("if (userData?.popup_enabled)"));
    expect(launcher).toContain("className = 'lvb-launcher'");
    expect(launcher).not.toContain("host=top-nav");
    expect(launcher).not.toContain("host: 'top-nav'");
    expect(source.indexOf("if ((userData as any)?.top_nav_widget_enabled)")).toBeLessThan(source.indexOf("if (userData?.popup_enabled)"));
  });
});

describe("logo slot and theme customizer copy", () => {
  test("uploaded logos are contained and older scale rules are cancelled", () => {
    const css = logoSlotCSS();
    expect(css).toContain("object-fit: contain");
    expect(css).toContain("transform: none");
    expect(css).toContain("max-height: 40px");
    expect(css).toContain(".hl_header");
  });

  test("the customizer keeps default icons and upload-only logos", () => {
    const src = readFileSync("public/theme-builder.js", "utf8");
    expect(src).toContain("Keep default icons");
    expect(src).toContain("Using the default icons");
    expect(src).not.toContain("Keep GHL icons");
    expect(src).not.toContain("Using the GHL icons");
    expect(src).not.toContain("paste a hosted");
    expect(src).not.toContain('type="url" data-field="logoUrl"');
    expect(src).toContain(".hl_nav-settings::after{box-shadow:none!important");
    expect(src).toContain("max-height:40px!important");
  });

  test("Launchpad stays a rocket in the shared packs, and Keystone alone paints a lightning bolt", () => {
    const src = readFileSync("public/theme-builder.js", "utf8");
    expect(src).toContain('launchpad: "rocket"');
    expect(src).toContain('launchpad: "rocket-launch"');
    const iconUrl = src.slice(src.indexOf("function iconUrl"), src.indexOf("function packRef"));
    expect(iconUrl).toContain('ov = "lucide:zap"');
    expect(iconUrl).toContain("keystoneAgency()");
    expect(iconUrl.indexOf("keystoneAgency()")).toBeLessThan(iconUrl.indexOf("pack.map"));
    expect(src).toContain('company === "lwqohtpjyvzd7t9led1u"');
    expect(src).toContain('key === "keystone"');
    expect(src).toContain('key === "keystone-3"');
  });

  test("newly generated branding templates no longer scale the logo", () => {
    const src = readFileSync("src/components/BrandingTool.tsx", "utf8");
    expect(src).not.toContain("scale(1.45)");
    expect(src).not.toContain("height: 60px");
    expect(src).toContain("object-fit: contain !important");
  });
});
