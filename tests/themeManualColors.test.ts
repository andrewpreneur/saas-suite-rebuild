import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("public/theme-builder.js", "utf8");
const helpers = source.slice(source.indexOf("  function lum(hex)"), source.indexOf("  var PRESETS"));
const defaults = {
  sidebarBg: "#FFFFFF", sidebarBgEnd: "#FFFFFF", sidebarText: "#111827",
  accent: "#FC2145", accentText: "#111827", headerBg: "#FFFFFF", icons: {},
};
const clean = new Function("t", `
  var HEX = /^#[0-9a-f]{6}$/i;
  var DEFAULT = ${JSON.stringify(defaults)};
  var COLOR_FIELDS = ${JSON.stringify(Object.keys(defaults).filter(key => key !== "icons").map(key => [key]))};
  var PACKS = {};
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function safeUrl() { return false; }
  function safeIconRef() { return false; }
  function clamp(v, min, max, fallback) { return Number.isFinite(+v) ? Math.max(min, Math.min(max, +v)) : fallback; }
  ${helpers}
  return clean(t, DEFAULT);
`) as (theme: Record<string, unknown>) => Record<string, unknown>;

describe("manual Theme Customizer colors", () => {
  test("page buttons use the chosen highlight even when it is light", () => {
    const inkSource = source.slice(source.indexOf("  function inkFor(t)"), source.indexOf("  function clean(t, base)"));
    const ink = new Function("t", `${inkSource}; return inkFor(t);`);
    expect(ink({ accent: "#D4A72C", sidebarBg: "#FFFFFF", sidebarText: "#111827" })).toBe("#D4A72C");
    expect(ink({ accent: "#FFFFFF", sidebarBg: "#111827", sidebarText: "#FFFFFF" })).toBe("#FFFFFF");
  });
  test("Keystone white highlight text survives preview and repeated saved-theme cleanup", () => {
    const theme = clean({ ...defaults, accent: "#fc2145", accentText: "#ffffff" });
    expect(theme.accentText).toBe("#FFFFFF");
    expect(clean(theme).accentText).toBe("#FFFFFF");
  });
  test("all six manual controls preserve valid selections, including low-contrast sidebar text", () => {
    for (const field of Object.keys(defaults).filter(key => key !== "icons")) {
      const theme = clean({ ...defaults, [field]: "#abcdef" });
      expect(theme[field]).toBe("#ABCDEF");
    }
    expect(clean({ ...defaults, sidebarText: "#ffffff" }).sidebarText).toBe("#FFFFFF");
  });
  test("automatic sidebar ink and missing highlight text still choose readable defaults", () => {
    expect(clean({ ...defaults, sidebarText: "auto" }).sidebarText).toBe("#111827");
    expect(clean({ accent: "#2F6FED" }).accentText).toBe("#FFFFFF");
    expect(clean({ accent: "#D4A72C" }).accentText).toBe("#111827");
  });
  test("invalid manual colors cannot replace validated defaults", () => {
    expect(clean({ ...defaults, headerBg: "not-a-color" }).headerBg).toBe("#FFFFFF");
  });
});