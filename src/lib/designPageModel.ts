import { SWITCHYARD_DEFAULTS, type SwitchyardColors } from "../../supabase/functions/_shared/switchyardTheme";
import { MINIMALIST_SIDEBAR_DEFAULT } from "@/lib/brandingSave";
import {
  DEFAULT_CARD_SUBTITLE,
  DEFAULT_CARD_TITLE,
  sanitizeTopNavWidgetConfig,
  type TopNavWidgetOption,
  type TopNavWidgetShowOn,
} from "@/lib/topNavWidgetOptions";

export type DesignTab = "style" | "layout" | "widgets" | "advanced";
export type PreviewSurface = "sidebar" | "hub" | "login";
export type PreviewDevice = "desktop" | "mobile";
export type SidebarStyle = "v1" | "v2" | "v3" | "switchyard";
export type TopNavColorMode = "primary" | "secondary" | "tertiary" | "custom";

/** Editor state for the top navigation help widget. Same columns as today. */
export interface TopNavEditorState {
  enabled: boolean;
  label: string;
  cardTitle: string;
  cardSubtitle: string;
  showOn: TopNavWidgetShowOn;
  options: TopNavWidgetOption[];
  modes: Record<"button" | "icon" | "tile", TopNavColorMode>;
  customs: Record<"button" | "icon" | "tile", string>;
}

/** Everything the Design page can change, saved or draft. */
export interface DesignSnapshot {
  sidebarStyle: SidebarStyle | null;
  switchyard?: SwitchyardColors;
  customizerEnabled?: boolean;
  faviconUrl?: string;
  primaryColor: string;
  sidebarBgColor: string;
  font: string;
  iconPack: string;
  motion: boolean;
  gradientCustomEnabled: boolean;
  gradientStart: string;
  gradientEnd: string;
  topGradientCustomEnabled: boolean;
  topGradientStart: string;
  topGradientEnd: string;
  loginCustomEnabled: boolean;
  loginBackground: string | null;
  loginLogoUrl: string;
  buttonCustomEnabled: boolean;
  layout: number;
  layoutKnown: boolean;
  popupEnabled: boolean;
  mobileEnabled: boolean;
  mobileMenuColor: string;
  mobileZoomEnabled: boolean;
  topNav: TopNavEditorState;
}

export type DesignWrite =
  | { kind: "sidebar" }
  | { kind: "colors" }
  | { kind: "favicon" }
  | { kind: "login"; clear: boolean }
  | { kind: "buttons"; clear: boolean }
  | { kind: "layout"; table: "agency_ui_versions"; column: "ui_version"; value: number }
  | { kind: "popup"; table: "saas_suite_users"; column: "popup_enabled"; value: boolean }
  | {
      kind: "mobile";
      table: "saas_suite_users";
      columns: ["mobile_branding_enabled", "mobile_menu_color", "mobile_zoom_enabled"];
      value: { enabled: boolean; menuColor: string; zoomEnabled: boolean };
    }
  | { kind: "topNav"; table: "saas_suite_users"; columns: string[]; patch: TopNavColumnPatch };

export interface TopNavColumnPatch {
  top_nav_widget_enabled?: boolean;
  top_nav_widget_label?: string;
  top_nav_widget_color_mode?: string;
  top_nav_widget_custom_color?: string | null;
  top_nav_widget_icon_color_mode?: string | null;
  top_nav_widget_icon_custom_color?: string | null;
  top_nav_widget_tile_color_mode?: string | null;
  top_nav_widget_tile_custom_color?: string | null;
  top_nav_widget_options?: {
    title: string;
    subtitle: string;
    showOn: TopNavWidgetShowOn;
    options: TopNavWidgetOption[];
  };
}

const COLOR_MODES = new Set(["primary", "secondary", "tertiary", "custom"]);

export function defaultTopNav(): TopNavEditorState {
  const menu = sanitizeTopNavWidgetConfig(null);
  return {
    enabled: false,
    label: "Help & Support",
    cardTitle: menu.title,
    cardSubtitle: menu.subtitle,
    showOn: menu.showOn,
    options: menu.options,
    modes: { button: "primary", icon: "primary", tile: "primary" },
    customs: { button: "#000000", icon: "#000000", tile: "#000000" },
  };
}

export function emptyDesignSnapshot(): DesignSnapshot {
  return {
    sidebarStyle: null,
    switchyard: { ...SWITCHYARD_DEFAULTS },
    customizerEnabled: true,
    faviconUrl: "",
    primaryColor: "#16a34a",
    sidebarBgColor: "#ffffff",
    font: "Inter",
    iconPack: "lucide",
    motion: true,
    gradientCustomEnabled: false,
    gradientStart: "#16a34a",
    gradientEnd: "#0b3d1f",
    topGradientCustomEnabled: false,
    topGradientStart: "#3d54ff",
    topGradientEnd: "#2233a3",
    loginCustomEnabled: false,
    loginBackground: null,
    loginLogoUrl: "",
    buttonCustomEnabled: false,
    layout: 2,
    layoutKnown: false,
    popupEnabled: false,
    mobileEnabled: false,
    mobileMenuColor: "#3b82f6",
    mobileZoomEnabled: true,
    topNav: defaultTopNav(),
  };
}

export function sidebarStyleOf(
  themeBuilderMode: boolean,
  isV2Mode: boolean | null,
): SidebarStyle | null {
  if (themeBuilderMode) return "v3";
  if (isV2Mode === true) return "v2";
  if (isV2Mode === false) return "v1";
  return null;
}

export function styleFlags(style: SidebarStyle | null): {
  themeBuilderMode: boolean;
  isV2Mode: boolean | null;
} {
  if (style === "v3") return { themeBuilderMode: true, isV2Mode: null };
  if (style === "v2") return { themeBuilderMode: false, isV2Mode: true };
  if (style === "v1") return { themeBuilderMode: false, isV2Mode: false };
  return { themeBuilderMode: false, isV2Mode: null };
}

function normColor(value: string): string {
  return value.trim().toLowerCase();
}

function sameColor(a: string, b: string): boolean {
  return normColor(a) === normColor(b);
}

function colorMode(value: string | null | undefined): TopNavColorMode {
  return value && COLOR_MODES.has(value) ? (value as TopNavColorMode) : "primary";
}

export function topNavFromRow(row: {
  top_nav_widget_enabled?: boolean | null;
  top_nav_widget_label?: string | null;
  top_nav_widget_color_mode?: string | null;
  top_nav_widget_custom_color?: string | null;
  top_nav_widget_icon_color_mode?: string | null;
  top_nav_widget_icon_custom_color?: string | null;
  top_nav_widget_tile_color_mode?: string | null;
  top_nav_widget_tile_custom_color?: string | null;
  top_nav_widget_options?: unknown;
}): TopNavEditorState {
  const menu = sanitizeTopNavWidgetConfig(row.top_nav_widget_options);
  const base = defaultTopNav();
  return {
    enabled: !!row.top_nav_widget_enabled,
    label: row.top_nav_widget_label || base.label,
    cardTitle: menu.title || DEFAULT_CARD_TITLE,
    cardSubtitle: menu.subtitle || DEFAULT_CARD_SUBTITLE,
    showOn: menu.showOn,
    options: menu.options,
    modes: {
      button: colorMode(row.top_nav_widget_color_mode),
      icon: colorMode(row.top_nav_widget_icon_color_mode),
      tile: colorMode(row.top_nav_widget_tile_color_mode),
    },
    customs: {
      button: row.top_nav_widget_custom_color || "#000000",
      icon: row.top_nav_widget_icon_custom_color || "#000000",
      tile: row.top_nav_widget_tile_custom_color || "#000000",
    },
  };
}

function optionsKey(state: TopNavEditorState): string {
  return JSON.stringify({
    title: state.cardTitle.trim() || DEFAULT_CARD_TITLE,
    subtitle: state.cardSubtitle.trim() || DEFAULT_CARD_SUBTITLE,
    showOn: state.showOn,
    options: state.options,
  });
}

function topNavDiffers(saved: TopNavEditorState, draft: TopNavEditorState): boolean {
  if (saved.enabled !== draft.enabled) return true;
  if ((saved.label.trim() || "Help & Support") !== (draft.label.trim() || "Help & Support"))
    return true;
  if (saved.modes.button !== draft.modes.button) return true;
  if (saved.modes.icon !== draft.modes.icon) return true;
  if (saved.modes.tile !== draft.modes.tile) return true;
  if (!sameColor(saved.customs.button, draft.customs.button)) return true;
  if (!sameColor(saved.customs.icon, draft.customs.icon)) return true;
  if (!sameColor(saved.customs.tile, draft.customs.tile)) return true;
  return optionsKey(saved) !== optionsKey(draft);
}

/** Names of unsaved edits. "Accent" is never one of them. */
export function dirtyLabels(saved: DesignSnapshot, draft: DesignSnapshot): string[] {
  const labels: string[] = [];
  if (saved.faviconUrl !== draft.faviconUrl) labels.push("Browser tab icon");
  if (draft.sidebarStyle === "switchyard" && (JSON.stringify(saved.switchyard) !== JSON.stringify(draft.switchyard) || saved.customizerEnabled !== draft.customizerEnabled)) labels.push("Switchyard colors");
  const styleChanged = saved.sidebarStyle !== draft.sidebarStyle;
  const bgChanged = !sameColor(saved.sidebarBgColor, draft.sidebarBgColor);
  if (styleChanged) labels.push("Sidebar style");
  const autoMinimal =
    styleChanged &&
    draft.sidebarStyle === "v3" &&
    sameColor(draft.sidebarBgColor, MINIMALIST_SIDEBAR_DEFAULT);
  if (bgChanged && !autoMinimal) labels.push("Sidebar background");
  if (!sameColor(saved.primaryColor, draft.primaryColor)) labels.push("Login & top button color");
  if (saved.font !== draft.font) labels.push("Font");
  if (saved.iconPack !== draft.iconPack) labels.push("Icon style");
  if (saved.motion !== draft.motion) labels.push("Navigation animations");
  // Same rule as sidebarDirty: gradient colors are derived while the switch is off.
  if (
    draft.sidebarStyle === "v2" &&
    (saved.gradientCustomEnabled !== draft.gradientCustomEnabled ||
      (draft.gradientCustomEnabled &&
        (!sameColor(saved.gradientStart, draft.gradientStart) ||
          !sameColor(saved.gradientEnd, draft.gradientEnd))))
  ) {
    labels.push("Simple sidebar gradient");
  }
  if (
    saved.loginCustomEnabled !== draft.loginCustomEnabled ||
    (draft.loginCustomEnabled &&
      (saved.loginBackground !== draft.loginBackground ||
        saved.loginLogoUrl !== draft.loginLogoUrl))
  ) {
    labels.push("Login page customization");
  }
  if (saved.buttonCustomEnabled !== draft.buttonCustomEnabled)
    labels.push("Top button customization");
  if (
    draft.buttonCustomEnabled &&
    (saved.topGradientCustomEnabled !== draft.topGradientCustomEnabled ||
      (draft.topGradientCustomEnabled &&
        (!sameColor(saved.topGradientStart, draft.topGradientStart) ||
          !sameColor(saved.topGradientEnd, draft.topGradientEnd))))
  ) {
    labels.push("Top button gradient");
  }
  if (saved.layout !== draft.layout) labels.push("Client Hub layout");
  if (saved.popupEnabled !== draft.popupEnabled) labels.push("Bottom right chat popup");
  if (topNavDiffers(saved.topNav, draft.topNav)) labels.push("Top navigation help widget");
  if (saved.mobileEnabled !== draft.mobileEnabled) labels.push("Mobile branding");
  if (!sameColor(saved.mobileMenuColor, draft.mobileMenuColor)) labels.push("Menu widget color");
  if (saved.mobileZoomEnabled !== draft.mobileZoomEnabled) labels.push("Zoom controls");
  return labels;
}

/**
 * Edits that can only be stored inside a sidebar stylesheet.
 * With no sidebar style chosen they cannot be saved, so Save must keep them
 * listed as unsaved and say why.
 */
export function styleOnlyPendingLabels(saved: DesignSnapshot, draft: DesignSnapshot): string[] {
  if (draft.sidebarStyle) return [];
  const labels: string[] = [];
  if (saved.font !== draft.font) labels.push("Font");
  if (saved.iconPack !== draft.iconPack) labels.push("Icon style");
  if (saved.motion !== draft.motion) labels.push("Navigation animations");
  return labels;
}

export function unsavedChangeText(labels: string[]): string {
  if (labels.length === 0) return "All changes saved";
  if (labels.length === 1) return `1 unsaved change: ${labels[0]}`;
  return `${labels.length} unsaved changes: ${labels.join(", ")}`;
}

export function unsavedChangeBar(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return `You have 1 unsaved change: ${labels[0]}`;
  return `You have ${labels.length} unsaved changes: ${labels.join(", ")}`;
}

function sidebarDirty(saved: DesignSnapshot, draft: DesignSnapshot): boolean {
  if (saved.sidebarStyle !== draft.sidebarStyle) return true;
  if (!draft.sidebarStyle && !saved.sidebarStyle) return false;
  if (draft.sidebarStyle === "switchyard" && (JSON.stringify(saved.switchyard) !== JSON.stringify(draft.switchyard) || saved.customizerEnabled !== draft.customizerEnabled)) return true;
  if (!sameColor(saved.primaryColor, draft.primaryColor)) return true;
  if (!sameColor(saved.sidebarBgColor, draft.sidebarBgColor)) return true;
  if (saved.font !== draft.font) return true;
  if (saved.iconPack !== draft.iconPack) return true;
  if (saved.motion !== draft.motion) return true;
  if (
    draft.sidebarStyle === "v2" &&
    (saved.gradientCustomEnabled !== draft.gradientCustomEnabled ||
      (draft.gradientCustomEnabled &&
        (!sameColor(saved.gradientStart, draft.gradientStart) ||
          !sameColor(saved.gradientEnd, draft.gradientEnd))))
  ) {
    return true;
  }
  return false;
}

function topNavPatch(saved: TopNavEditorState, draft: TopNavEditorState): TopNavColumnPatch | null {
  const patch: TopNavColumnPatch = {};
  if (saved.enabled !== draft.enabled) patch.top_nav_widget_enabled = draft.enabled;
  const nextLabel = draft.label.trim() || "Help & Support";
  if ((saved.label.trim() || "Help & Support") !== nextLabel)
    patch.top_nav_widget_label = nextLabel;
  if (saved.modes.button !== draft.modes.button)
    patch.top_nav_widget_color_mode = draft.modes.button;
  if (!sameColor(saved.customs.button, draft.customs.button))
    patch.top_nav_widget_custom_color = draft.customs.button;
  if (saved.modes.icon !== draft.modes.icon)
    patch.top_nav_widget_icon_color_mode = draft.modes.icon;
  if (!sameColor(saved.customs.icon, draft.customs.icon))
    patch.top_nav_widget_icon_custom_color = draft.customs.icon;
  if (saved.modes.tile !== draft.modes.tile)
    patch.top_nav_widget_tile_color_mode = draft.modes.tile;
  if (!sameColor(saved.customs.tile, draft.customs.tile))
    patch.top_nav_widget_tile_custom_color = draft.customs.tile;
  if (optionsKey(saved) !== optionsKey(draft)) {
    patch.top_nav_widget_options = {
      title: draft.cardTitle.trim() || DEFAULT_CARD_TITLE,
      subtitle: draft.cardSubtitle.trim() || DEFAULT_CARD_SUBTITLE,
      showOn: draft.showOn,
      options: draft.options,
    };
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * Which existing writes a global Save must run.
 * Sidebar, login, and button CSS still go through the current generated_css parts.
 */
export function designSavePlan(saved: DesignSnapshot, draft: DesignSnapshot): DesignWrite[] {
  const writes: DesignWrite[] = [];
  if (saved.faviconUrl !== draft.faviconUrl) writes.push({ kind: "favicon" });
  if (sidebarDirty(saved, draft) && draft.sidebarStyle) writes.push({ kind: "sidebar" });
  // With no sidebar style there is no stylesheet to carry the colors, so they
  // are stored on the account row. Without this, Save reported success and wrote nothing.
  else if (
    !draft.sidebarStyle &&
    (!sameColor(saved.primaryColor, draft.primaryColor) ||
      !sameColor(saved.sidebarBgColor, draft.sidebarBgColor))
  )
    writes.push({ kind: "colors" });
  const loginDirty =
    saved.loginCustomEnabled !== draft.loginCustomEnabled ||
    (draft.loginCustomEnabled &&
      (saved.loginBackground !== draft.loginBackground ||
        saved.loginLogoUrl !== draft.loginLogoUrl ||
        !sameColor(saved.primaryColor, draft.primaryColor)));
  if (loginDirty) writes.push({ kind: "login", clear: !draft.loginCustomEnabled });
  const buttonsDirty =
    saved.buttonCustomEnabled !== draft.buttonCustomEnabled ||
    (draft.buttonCustomEnabled &&
      (!sameColor(saved.primaryColor, draft.primaryColor) ||
        !sameColor(saved.sidebarBgColor, draft.sidebarBgColor) ||
        saved.topGradientCustomEnabled !== draft.topGradientCustomEnabled ||
        (draft.topGradientCustomEnabled &&
          (!sameColor(saved.topGradientStart, draft.topGradientStart) ||
            !sameColor(saved.topGradientEnd, draft.topGradientEnd)))));
  if (buttonsDirty) writes.push({ kind: "buttons", clear: !draft.buttonCustomEnabled });
  if (saved.layout !== draft.layout) {
    writes.push({
      kind: "layout",
      table: "agency_ui_versions",
      column: "ui_version",
      value: draft.layout,
    });
  }
  if (saved.popupEnabled !== draft.popupEnabled) {
    writes.push({
      kind: "popup",
      table: "saas_suite_users",
      column: "popup_enabled",
      value: draft.popupEnabled,
    });
  }
  if (
    saved.mobileEnabled !== draft.mobileEnabled ||
    !sameColor(saved.mobileMenuColor, draft.mobileMenuColor) ||
    saved.mobileZoomEnabled !== draft.mobileZoomEnabled
  ) {
    writes.push({
      kind: "mobile",
      table: "saas_suite_users",
      columns: ["mobile_branding_enabled", "mobile_menu_color", "mobile_zoom_enabled"],
      value: {
        enabled: draft.mobileEnabled,
        menuColor: draft.mobileMenuColor,
        zoomEnabled: draft.mobileZoomEnabled,
      },
    });
  }
  const nav = topNavPatch(saved.topNav, draft.topNav);
  if (nav) {
    writes.push({
      kind: "topNav",
      table: "saas_suite_users",
      columns: Object.keys(nav),
      patch: nav,
    });
  }
  return writes;
}

export function previewForTab(tab: DesignTab): {
  surface: PreviewSurface;
  device: PreviewDevice | null;
} {
  if (tab === "layout") return { surface: "hub", device: null };
  if (tab === "widgets") return { surface: "hub", device: "mobile" };
  if (tab === "advanced") return { surface: "login", device: null };
  return { surface: "sidebar", device: null };
}

export function tabChecked(tab: DesignTab, active: DesignTab, draft: DesignSnapshot): boolean {
  if (tab === active) return false;
  if (tab === "style") return draft.sidebarStyle !== null;
  if (tab === "layout") return draft.layoutKnown || draft.layout !== 2;
  if (tab === "widgets") return draft.popupEnabled || draft.topNav.enabled;
  return draft.loginCustomEnabled || draft.buttonCustomEnabled || draft.mobileEnabled;
}

/**
 * Theme Customizer install badge.
 * A hub install or a confirmed install means the Custom JS tag is in place.
 * `preview` is only honored for the local platform mock.
 */
export function resolveThemeInstallStatus(input: {
  hubInstalled: boolean;
  installConfirmedAt: string | null;
  preview?: string | null;
}): boolean {
  if (input.preview === "missing") return false;
  if (input.preview === "installed") return true;
  return input.hubInstalled || Boolean(input.installConfirmedAt);
}
