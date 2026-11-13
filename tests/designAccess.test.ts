import { describe, expect, test } from "bun:test";
import { accountRank, UPGRADE_PLANS } from "../supabase/functions/chat-copilot/billingPolicy";
import {
  designBrandingUnlocked,
  designThemeUnlocked,
  filterDesignWrites,
  minimumBrandingPlanName,
  visibleDesignLabels,
} from "../src/lib/designAccess";
import {
  defaultTopNav,
  designSavePlan,
  dirtyLabels,
  emptyDesignSnapshot,
} from "../src/lib/designPageModel";

const OPEN = ["Client Hub layout", "Bottom right chat popup", "Top navigation help widget"];

describe("Design plan gates", () => {
  test("Starter can open Design widgets; branding and the Theme Customizer start at Basic", () => {
    for (const plan of [null, undefined, "", "STARTER", "starter", "free"]) {
      expect(designBrandingUnlocked(plan)).toBe(false);
      expect(designThemeUnlocked(plan)).toBe(false);
    }
    for (const plan of ["BASIC", "basic", "ADVANCED", "PREMIUM", "ENHANCED"]) {
      expect(designBrandingUnlocked(plan)).toBe(true);
      expect(designThemeUnlocked(plan)).toBe(true);
    }
    expect(designBrandingUnlocked("STARTER", true)).toBe(true);
    expect(designBrandingUnlocked("STARTER")).toBe(
      accountRank({ plan: "STARTER" }) >= UPGRADE_PLANS.basic.rank,
    );
    expect(designBrandingUnlocked("BASIC")).toBe(
      accountRank({ plan: "BASIC" }) >= UPGRADE_PLANS.basic.rank,
    );
    expect(minimumBrandingPlanName()).toBe(UPGRADE_PLANS.basic.name);
  });

  test("a standalone branding purchase unlocks branding on Starter without unlocking by itself", () => {
    for (const plan of [null, undefined, "", "STARTER", "starter", "free"]) {
      expect(designBrandingUnlocked(plan, false, false)).toBe(false);
      expect(designThemeUnlocked(plan, false, false)).toBe(false);
      expect(designBrandingUnlocked(plan, false, true)).toBe(true);
      expect(designThemeUnlocked(plan, false, true)).toBe(true);
    }
    expect(designBrandingUnlocked("BASIC", false, false)).toBe(true);
    expect(designBrandingUnlocked("ADVANCED", false, false)).toBe(true);
    expect(designBrandingUnlocked("STARTER", true, false)).toBe(true);
  });

  test("Starter saves layout and widgets, and drops branding writes", () => {
    const writes = [
      { kind: "sidebar" },
      { kind: "login", clear: false },
      { kind: "buttons", clear: true },
      { kind: "mobile", value: true },
      { kind: "layout", value: 3 },
      { kind: "popup", value: true },
      { kind: "topNav", patch: { top_nav_widget_enabled: true } },
    ];
    expect(filterDesignWrites(writes, "STARTER").map((write) => write.kind)).toEqual([
      "layout",
      "popup",
      "topNav",
    ]);
    expect(filterDesignWrites(writes, "STARTER", false, true)).toEqual(writes);
    expect(filterDesignWrites(writes, "BASIC")).toEqual(writes);
    expect(filterDesignWrites(writes, "BASIC", false, false)).toEqual(writes);
    expect(filterDesignWrites(writes, "ADVANCED")).toEqual(writes);

    const labels = [
      "Sidebar style",
      "Login page customization",
      "Mobile branding",
      ...OPEN,
    ];
    expect(visibleDesignLabels(labels, "STARTER")).toEqual(OPEN);
    expect(visibleDesignLabels(labels, "STARTER", false, true)).toEqual(labels);
    expect(visibleDesignLabels(labels, "BASIC")).toEqual(labels);
  });

  test("a mixed Design draft keeps widget writes for Starter and every write for Basic", () => {
    const saved = emptyDesignSnapshot();
    const draft = {
      ...saved,
      sidebarStyle: "v2" as const,
      loginCustomEnabled: true,
      buttonCustomEnabled: true,
      layout: 3,
      layoutKnown: true,
      popupEnabled: true,
      mobileEnabled: true,
      topNav: { ...defaultTopNav(), enabled: true },
    };
    const plan = designSavePlan(saved, draft);
    expect(plan.map((write) => write.kind)).toEqual([
      "sidebar",
      "login",
      "buttons",
      "layout",
      "popup",
      "mobile",
      "topNav",
    ]);
    expect(filterDesignWrites(plan, "STARTER").map((write) => write.kind)).toEqual([
      "layout",
      "popup",
      "topNav",
    ]);
    expect(filterDesignWrites(plan, "STARTER", false, true).map((write) => write.kind)).toEqual(
      plan.map((write) => write.kind),
    );
    expect(filterDesignWrites(plan, "BASIC").map((write) => write.kind)).toEqual(
      plan.map((write) => write.kind),
    );
    const labels = dirtyLabels(saved, draft);
    expect(visibleDesignLabels(labels, "STARTER")).toEqual(OPEN);
    expect(labels).toContain("Sidebar style");
  });
});
