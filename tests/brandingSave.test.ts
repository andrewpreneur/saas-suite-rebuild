import { expect, test } from "bun:test";
import { assertBrandingSaved, minimalistSidebarCSS, MINIMALIST_SIDEBAR_DEFAULT } from "../src/lib/brandingSave";
import { readBrandingTheme } from "../src/lib/brandingTheme";
import { splitBrandingCSS, updateBrandingPart } from "../src/lib/brandingSections";

test("new Minimalist setups default to neutral white rather than green", () => {
  expect(MINIMALIST_SIDEBAR_DEFAULT).toBe("#ffffff");
  const css = minimalistSidebarCSS({ version: "v3", motion: true, iconPack: "lucide", font: "Roboto", sidebarBg: MINIMALIST_SIDEBAR_DEFAULT, accent: "#3b82f6" });
  expect(readBrandingTheme(css)?.sidebarBg).toBe("#ffffff");
  expect(css).toContain("--ss-minimal-bg: #ffffff");
  expect(css).toContain("--ss-minimal-text: #111111");
});
test("Minimalist preserves a deliberately saved custom surface and readable text", () => {
  const css = minimalistSidebarCSS({ version: "v3", motion: false, iconPack: "default", font: "Roboto", sidebarBg: "#123456", accent: "#3b82f6" });
  expect(readBrandingTheme(css)?.sidebarBg).toBe("#123456");
  expect(css).toContain("--ss-minimal-text: #ffffff");
});
test("Minimalist survives account apply/readback without replacing independent login styling", () => {
  const sidebar = minimalistSidebarCSS({ version: "v3", motion: true, iconPack: "lucide", font: "Roboto", sidebarBg: "#ffffff", accent: "#3b82f6" });
  const saved = updateBrandingPart(updateBrandingPart("", "login", "login-css"), "sidebar", sidebar);
  assertBrandingSaved(saved, saved);
  expect(splitBrandingCSS(saved).login).toBe("login-css");
  expect(readBrandingTheme(splitBrandingCSS(saved).sidebar)?.version).toBe("v3");
  expect(() => assertBrandingSaved(saved, null)).toThrow();
  expect(() => assertBrandingSaved(saved, "previous css")).toThrow();
});