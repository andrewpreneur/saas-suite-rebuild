import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  defaultTopNav,
  designSavePlan,
  dirtyLabels,
  emptyDesignSnapshot,
  previewForTab,
  resolveThemeInstallStatus,
  sidebarStyleOf,
  styleFlags,
  styleOnlyPendingLabels,
  tabChecked,
  unsavedChangeBar,
  unsavedChangeText,
  type DesignSnapshot,
} from "../src/lib/designPageModel";

function withStyle(
  style: DesignSnapshot["sidebarStyle"],
  extra: Partial<DesignSnapshot> = {},
): DesignSnapshot {
  return {
    ...emptyDesignSnapshot(),
    sidebarStyle: style,
    layoutKnown: true,
    ...extra,
    topNav: extra.topNav ?? defaultTopNav(),
  };
}

describe("Design page save model", () => {
  test("changing the sidebar style is one unsaved change and writes the sidebar stylesheet", () => {
    const saved = withStyle("v2");
    const draft = withStyle("v1");
    const labels = dirtyLabels(saved, draft);
    expect(labels).toEqual(["Sidebar style"]);
    expect(labels.join(" ")).not.toContain("Accent");
    expect(unsavedChangeText(labels)).toBe("1 unsaved change: Sidebar style");
    expect(unsavedChangeBar(labels)).toBe("You have 1 unsaved change: Sidebar style");
    expect(designSavePlan(saved, draft)).toEqual([{ kind: "sidebar" }]);
    expect(dirtyLabels(draft, draft)).toEqual([]);
    expect(unsavedChangeText([])).toBe("All changes saved");
  });

  test("switching to Minimalist does not also name the automatic sidebar background", () => {
    const saved = withStyle("v1", { sidebarBgColor: "#111827" });
    const draft = withStyle("v3", { sidebarBgColor: "#ffffff" });
    expect(dirtyLabels(saved, draft)).toEqual(["Sidebar style"]);
  });

  test("a separate sidebar background edit keeps its own name", () => {
    const saved = withStyle("v2", { sidebarBgColor: "#ffffff" });
    const draft = withStyle("v2", { sidebarBgColor: "#111827" });
    expect(dirtyLabels(saved, draft)).toEqual(["Sidebar background"]);
    expect(designSavePlan(saved, draft)).toEqual([{ kind: "sidebar" }]);
  });

  test("Simple gradient colors stay out of the badge while that switch is off", () => {
    const saved = withStyle("v2", {
      primaryColor: "#16a34a",
      sidebarBgColor: "#ffffff",
      gradientCustomEnabled: false,
      gradientStart: "#16a34a",
      gradientEnd: "#5a9a6a",
    });
    const highlight = withStyle("v2", {
      primaryColor: "#ff00aa",
      sidebarBgColor: "#ffffff",
      gradientCustomEnabled: false,
      gradientStart: "#ff00aa",
      gradientEnd: "#aa4488",
    });
    expect(dirtyLabels(saved, highlight)).toEqual(["Login & top button color"]);
    const background = withStyle("v2", {
      primaryColor: "#16a34a",
      sidebarBgColor: "#eeeeee",
      gradientCustomEnabled: false,
      gradientStart: "#16a34a",
      gradientEnd: "#889988",
    });
    expect(dirtyLabels(saved, background)).toEqual(["Sidebar background"]);
    const enabled = withStyle("v2", {
      gradientCustomEnabled: true,
      gradientStart: "#112233",
      gradientEnd: "#445566",
    });
    expect(dirtyLabels(saved, enabled)).toEqual(["Simple sidebar gradient"]);
  });

  test("top button gradient colors stay out of the badge while that switch is off", () => {
    const saved = withStyle("v2", {
      buttonCustomEnabled: true,
      topGradientCustomEnabled: false,
      topGradientStart: "#16a34a",
      topGradientEnd: "#ffffff",
    });
    const synced = withStyle("v2", {
      buttonCustomEnabled: true,
      primaryColor: "#ff00aa",
      topGradientCustomEnabled: false,
      topGradientStart: "#ff00aa",
      topGradientEnd: "#111111",
    });
    expect(dirtyLabels(saved, synced)).toEqual(["Login & top button color"]);
  });

  test("the shared highlight color is saved as the login and top button color", () => {
    const saved = withStyle("v2", { loginCustomEnabled: true, buttonCustomEnabled: true });
    const draft = withStyle("v2", {
      loginCustomEnabled: true,
      buttonCustomEnabled: true,
      primaryColor: "#3b82f6",
    });
    expect(dirtyLabels(saved, draft)).toEqual(["Login & top button color"]);
    expect(designSavePlan(saved, draft).map((write) => write.kind)).toEqual([
      "sidebar",
      "login",
      "buttons",
    ]);
  });

  test("layout, popup, mobile, and the help widget keep their columns", () => {
    const saved = withStyle("v2");
    const draft = withStyle("v2", {
      layout: 1,
      popupEnabled: true,
      mobileEnabled: true,
      mobileMenuColor: "#112233",
      mobileZoomEnabled: false,
      topNav: { ...defaultTopNav(), enabled: true, label: "Help" },
    });
    const labels = dirtyLabels(saved, draft);
    expect(labels).toEqual([
      "Client Hub layout",
      "Bottom right chat popup",
      "Top navigation help widget",
      "Mobile branding",
      "Menu widget color",
      "Zoom controls",
    ]);
    const plan = designSavePlan(saved, draft);
    expect(plan).toEqual([
      { kind: "layout", table: "agency_ui_versions", column: "ui_version", value: 1 },
      { kind: "popup", table: "saas_suite_users", column: "popup_enabled", value: true },
      {
        kind: "mobile",
        table: "saas_suite_users",
        columns: ["mobile_branding_enabled", "mobile_menu_color", "mobile_zoom_enabled"],
        value: { enabled: true, menuColor: "#112233", zoomEnabled: false },
      },
      {
        kind: "topNav",
        table: "saas_suite_users",
        columns: ["top_nav_widget_enabled", "top_nav_widget_label"],
        patch: { top_nav_widget_enabled: true, top_nav_widget_label: "Help" },
      },
    ]);
  });

  test("turning login or top buttons off clears that generated CSS part", () => {
    const saved = withStyle("v2", { loginCustomEnabled: true, buttonCustomEnabled: true });
    const draft = withStyle("v2", { loginCustomEnabled: false, buttonCustomEnabled: false });
    expect(designSavePlan(saved, draft)).toEqual([
      { kind: "login", clear: true },
      { kind: "buttons", clear: true },
    ]);
  });

  test("turning sidebar branding off clears the draft style so Save does not write it back", () => {
    const saved = withStyle("v2", { primaryColor: "#112233", font: "Roboto", iconPack: "lucide" });
    const cleared = { ...saved, sidebarStyle: null as const };
    // The bug: saved style is cleared, but the draft still reports v1/v2/v3.
    expect(designSavePlan(cleared, saved)).toEqual([{ kind: "sidebar" }]);
    expect(dirtyLabels(cleared, saved)).toContain("Sidebar style");

    const flags = styleFlags(null);
    expect(flags).toEqual({ themeBuilderMode: false, isV2Mode: null });
    const draft = {
      ...saved,
      sidebarStyle: sidebarStyleOf(flags.themeBuilderMode, flags.isV2Mode),
    };
    expect(draft.sidebarStyle).toBeNull();
    expect(designSavePlan(cleared, draft)).toEqual([]);
    expect(dirtyLabels(cleared, draft)).toEqual([]);
  });

  test("hex case alone is not an unsaved change", () => {
    const saved = withStyle("v2", { primaryColor: "#16A34A" });
    const draft = withStyle("v2", { primaryColor: "#16a34a" });
    expect(dirtyLabels(saved, draft)).toEqual([]);
  });

  test("discard restores an identical snapshot", () => {
    const saved = withStyle("v3", { font: "Roboto", popupEnabled: true });
    const edited = withStyle("v1", { font: "Inter", popupEnabled: false });
    expect(dirtyLabels(saved, edited).length).toBeGreaterThan(0);
    expect(dirtyLabels(saved, { ...saved, topNav: saved.topNav })).toEqual([]);
  });
});

describe("Design page preview state", () => {
  test("each tab picks the preview surface, and widgets open on mobile", () => {
    expect(previewForTab("style")).toEqual({ surface: "sidebar", device: null });
    expect(previewForTab("layout")).toEqual({ surface: "hub", device: null });
    expect(previewForTab("widgets")).toEqual({ surface: "hub", device: "mobile" });
    expect(previewForTab("advanced")).toEqual({ surface: "login", device: null });
  });

  test("a check marks a configured section that is not the open tab", () => {
    const draft = withStyle("v2", { popupEnabled: true, loginCustomEnabled: true });
    expect(tabChecked("style", "layout", draft)).toBe(true);
    expect(tabChecked("layout", "layout", draft)).toBe(false);
    expect(tabChecked("widgets", "style", draft)).toBe(true);
    expect(tabChecked("advanced", "style", draft)).toBe(true);
    expect(tabChecked("advanced", "style", withStyle("v2"))).toBe(false);
  });
});

describe("Theme customizer install badge", () => {
  test("a confirmed hub install counts as detected, and the mock can preview the missing state", () => {
    expect(resolveThemeInstallStatus({ hubInstalled: false, installConfirmedAt: null })).toBe(
      false,
    );
    expect(resolveThemeInstallStatus({ hubInstalled: true, installConfirmedAt: null })).toBe(true);
    expect(
      resolveThemeInstallStatus({ hubInstalled: false, installConfirmedAt: "2026-01-01" }),
    ).toBe(true);
    expect(
      resolveThemeInstallStatus({
        hubInstalled: true,
        installConfirmedAt: "2026-01-01",
        preview: "missing",
      }),
    ).toBe(false);
  });
});

describe("Design page copy", () => {
  test("preset names are not invented", () => {
    const view = readFileSync(
      new URL("../src/components/design/DesignPageView.tsx", import.meta.url),
      "utf8",
    );
    const style =
      view.split('TabsContent value="style"')[1]?.split('TabsContent value="layout"')[0] ?? "";
    expect(view).not.toContain("Dark Purple");
    expect(view).not.toContain("Example Co");
    expect(view).toContain("Save as preset");
    expect(view).toContain("Edit in Settings");
    expect(style).toContain("Turn off branding");
    expect(style).toContain("Are you sure?");
    expect(style).toContain("savedStyle !== null");
    expect(view).not.toContain("Remove branding");
  });

  test("remove branding resets the draft mode flags through styleFlags(null)", () => {
    const source = readFileSync(
      new URL("../src/components/BrandingTool.tsx", import.meta.url),
      "utf8",
    );
    const body = source.split("const removeBranding")[1]?.split("const applyLogin")[0] ?? "";
    expect(body).toContain("styleFlags(null)");
    expect(body).toContain("setThemeBuilderMode(flags.themeBuilderMode)");
    expect(body).toContain("setIsV2Mode(flags.isV2Mode)");
    expect(body).toContain("setHasChangedSinceApply(false)");
    expect(body).toContain("setSidebarModeConfirmed(false)");
    expect(body).toContain("sidebarStyle: null");
  });
});

describe("Design page save with no sidebar style", () => {
  test("a color change is written to the account instead of reporting a save that wrote nothing", () => {
    const saved = withStyle(null, { primaryColor: "#112233" });
    const draft = { ...saved, primaryColor: "#445566" };
    expect(dirtyLabels(saved, draft)).toEqual(["Login & top button color"]);
    expect(designSavePlan(saved, draft)).toEqual([{ kind: "colors" }]);
    expect(designSavePlan(saved, { ...saved, sidebarBgColor: "#000000" })).toEqual([{ kind: "colors" }]);
  });

  test("with a sidebar style, colors still travel in the sidebar stylesheet only", () => {
    const saved = withStyle("v2", { primaryColor: "#112233" });
    const kinds = designSavePlan(saved, { ...saved, primaryColor: "#445566" }).map((write) => write.kind);
    expect(kinds).toContain("sidebar");
    expect(kinds).not.toContain("colors");
  });

  test("font, icon and animation edits stay unsaved until a sidebar style is chosen", () => {
    const saved = withStyle(null, { font: "Inter" });
    const draft = { ...saved, font: "Roboto" };
    expect(designSavePlan(saved, draft)).toEqual([]);
    expect(styleOnlyPendingLabels(saved, draft)).toEqual(["Font"]);
    expect(styleOnlyPendingLabels(withStyle("v2", { font: "Inter" }), withStyle("v2", { font: "Roboto" }))).toEqual([]);
  });
});
