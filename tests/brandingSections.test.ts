import { describe, test, expect } from "bun:test";
import { splitBrandingCSS, updateBrandingPart } from "../src/lib/brandingSections";

describe("Independent branding", () => {
  test("switching and removing branding never deletes unrelated CSS", () => {
    const css = updateBrandingPart("", "sidebar", "old-sidebar") + "\n.owner-extra { display: flex; }";
    for (const next of ["new-sidebar", ""]) {
      const result = updateBrandingPart(css, "sidebar", next);
      expect(result).toContain(".owner-extra { display: flex; }");
      expect(result).not.toContain("old-sidebar");
      expect(splitBrandingCSS(result).sidebar).toBe(next);
    }
  });
  const legacy = "sidebar rules\n/* === Login Page Customization === */\nlogin rules\n/* === Top Button Customization === */\nbutton rules";
  test("removing sidebar preserves login and top buttons", () => {
    const parts = splitBrandingCSS(updateBrandingPart(legacy, "sidebar", ""));
    expect(parts.sidebar).toBe("");
    expect(parts.login).toContain("login rules");
    expect(parts.buttons).toContain("button rules");
  });
  test("top buttons can be applied alone", () => {
    expect(splitBrandingCSS(updateBrandingPart("", "buttons", "button rules")))
      .toEqual({ sidebar: "", login: "", buttons: "button rules" });
  });
  test("reapplying login leaves sidebar and buttons unchanged", () => {
    const parts = splitBrandingCSS(updateBrandingPart(legacy, "login", "new login"));
    expect(parts.sidebar).toBe("sidebar rules");
    expect(parts.login).toBe("new login");
    expect(parts.buttons).toContain("button rules");
  });
});