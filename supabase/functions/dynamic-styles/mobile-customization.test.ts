import { test, expect } from "bun:test";
import { buildMobileCSS, buildMobileJS } from "./mobile-customization.ts";
import { xxiAdditionalCSS } from "./xxidesigns-additions.ts";

test("mobile color applies only to widget without replacing native sidebar colors", () => {
  const css = buildMobileCSS("#123456");
  expect(css).toContain("background: #123456 !important");
  expect(css).toContain("background: var(--color-sidebar-bg, inherit) !important");
  expect(css).not.toContain("var(--color-sidebar-bg, #fff)");
  expect(css).not.toContain("#173e5c");
});
test("mobile panel retains the native sidebar surface instead of a transparent anchor or white fallback", () => {
  const css = buildMobileCSS("#3b82f6");
  expect(css).not.toContain("height: 0 !important;\n    background: transparent !important;");
  expect(css).toContain("background: #3b82f6 !important");
});
test("invalid widget colors cannot inject styles", () => {
  expect(buildMobileCSS("red; } body { display:none")).toContain("background: #3b82f6 !important");
});
test("zoom defaults on and disabling it leaves menu and swipe handling unchanged", () => {
  const on = buildMobileJS(true);
  const off = buildMobileJS(false);
  expect(buildMobileJS()).toBe(on);
  expect(off).not.toBe(on);
  expect(off.replace("const active = false && mobile.matches &&", "const active = mobile.matches &&")).toBe(on);
});
test("sub-account touch patch follows animation patch and never targets agency navigation", () => {
  const patch = xxiAdditionalCSS.slice(xxiAdditionalCSS.indexOf("/* SUB-ACCOUNT TOUCH SCROLL PATCH"));
  expect(xxiAdditionalCSS.indexOf("/* SUB-ACCOUNT TOUCH SCROLL PATCH")).toBeGreaterThan(xxiAdditionalCSS.indexOf("MOTION + SPACING PATCH"));
  expect(patch).not.toContain(".sidebar-v2-agency");
  expect(patch).toContain("flex-shrink: 0 !important");
});