import { describe, expect, test } from "bun:test";
import {
  SITES_TOP_NAV_ITEMS,
  menuLinkRemovalCss,
  safeMenuLinkSelector,
  sitesTopNavHiddenExcept,
  sitesTopNavHiddenLinks,
} from "../supabase/functions/_shared/sitesTopNav.ts";

describe("sites top navigation CSS", () => {
  test("selected ids become display:none rules for those selectors", () => {
    const css = menuLinkRemovalCss(["#tb_funnels", "#tb_websites", "#tb_sites-domain-settings"]);
    expect(css).toBe(
      "#tb_funnels {\n  display: none !important;\n}\n\n"
      + "#tb_websites {\n  display: none !important;\n}\n\n"
      + "#tb_sites-domain-settings {\n  display: none !important;\n}\n\n",
    );
    for (const id of ["#tb_funnels", "#tb_websites", "#tb_sites-domain-settings"]) {
      expect(css).toContain(`${id} {\n  display: none !important;\n}`);
    }
  });

  test("no selected ids produce no rule", () => {
    expect(menuLinkRemovalCss([])).toBe("");
    expect(menuLinkRemovalCss(null)).toBe("");
    expect(menuLinkRemovalCss(undefined)).toBe("");
    expect(menuLinkRemovalCss(["", 12])).toBe("");
    expect(menuLinkRemovalCss([])).not.toContain("display");
  });

  test("existing sidebar selectors keep the same rule shape", () => {
    expect(menuLinkRemovalCss(["#sb_launchpad"])).toBe("#sb_launchpad {\n  display: none !important;\n}\n\n");
    const mixed = menuLinkRemovalCss(["#sb_contacts", "#tb_blogs"]);
    expect(mixed).toContain("#sb_contacts {\n  display: none !important;\n}");
    expect(mixed).toContain("#tb_blogs {\n  display: none !important;\n}");
  });

  test("everything hidden except QR Codes and Analytics is the catalog minus those two ids", () => {
    const hidden = sitesTopNavHiddenExcept(["#tb_qr-codes", "#tb_analytics"]);
    expect(hidden).toEqual([
      "#tb_funnels",
      "#tb_websites",
      "#tb_stores",
      "#tb_webinars",
      "#tb_blogs",
      "#tb_wordpress-v2",
      "#tb_clientportal",
      "#tb_form-builder",
      "#tb_survey-builder",
      "#tb_quiz-builder",
      "#tb_chat-widget",
      "#tb_sites-domain-settings",
    ]);
    expect(hidden).not.toContain("#tb_qr-codes");
    expect(hidden).not.toContain("#tb_analytics");
    const css = menuLinkRemovalCss(hidden);
    for (const id of hidden) expect(css).toContain(`${id} {\n  display: none !important;\n}`);
    expect(css).not.toContain("#tb_qr-codes");
    expect(css).not.toContain("#tb_analytics");
  });

  test("saved ids stay on the catalog and drop anything else", () => {
    expect(sitesTopNavHiddenLinks(["#tb_qr-codes", "#sb_contacts", "#tb_funnels", "#tb_funnels"])).toEqual([
      "#tb_funnels",
      "#tb_qr-codes",
    ]);
    expect(SITES_TOP_NAV_ITEMS).toHaveLength(14);
  });

  test("per-sub-account injection accepts sites ids and existing sidebar ids", () => {
    expect(safeMenuLinkSelector("#tb_funnels")).toBe("#tb_funnels");
    expect(safeMenuLinkSelector("#tb_wordpress-v2")).toBe("#tb_wordpress-v2");
    expect(safeMenuLinkSelector("#tb_sites-domain-settings")).toBe("#tb_sites-domain-settings");
    expect(safeMenuLinkSelector("#tb_not-a-real-item")).toBeNull();
    expect(safeMenuLinkSelector("#sb_launchpad")).toBe("#sb_launchpad");
    expect(safeMenuLinkSelector("#sb_AI Agents")).toBe('[id="sb_AI Agents"]');
    expect(safeMenuLinkSelector("#sb_common\\.sidebar\\.lcIntegrations")).toBe('[id="sb_common.sidebar.lcIntegrations"]');
    expect(safeMenuLinkSelector("body")).toBeNull();
  });
});
