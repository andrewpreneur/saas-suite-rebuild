import type { BrandingThemeOptions } from "./brandingTheme";
import { brandingThemeMarker } from "./brandingTheme";

export const MINIMALIST_SIDEBAR_DEFAULT = "#ffffff";

export function minimalistSidebarCSS(options: BrandingThemeOptions): string {
  const hex = options.sidebarBg.slice(1);
  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
  const text = luminance > 0.45 ? "#111111" : "#ffffff";
  const imageFilter = luminance > 0.45 ? "brightness(0)" : "brightness(0) invert(1)";
  const font = options.font.replace(/[^a-zA-Z0-9 -]/g, "");
  return `${brandingThemeMarker(options)}
/* Branding V3 Stylesheet — Minimalist */
#sidebar-v2 { --ss-minimal-bg: ${options.sidebarBg}; --ss-minimal-text: ${text}; --ss-minimal-accent: ${options.accent}; }
#sidebar-v2, #sidebar-v2.default-bg-color, #sidebar-v2 .default-bg-color,
#sidebar-v2 #location-switcher-sidbar-v2, #sidebar-v2 #globalSearchOpener,
#sidebar-v2 #quickActions, #sidebar-v2 #sb_settings, #sidebar-v2 #backButtonv2 {
  background: var(--ss-minimal-bg) !important; color: var(--ss-minimal-text) !important;
}
#sidebar-v2 { border: 0 !important; border-radius: 0 !important; margin: 0 !important; font-family: "${font}", sans-serif !important; }
#sidebar-v2 nav, #sidebar-v2 .hl_nav-header, #sidebar-v2 .hl_nav-settings { background: transparent !important; }
#sidebar-v2 nav a { color: var(--ss-minimal-text) !important; background: transparent !important; opacity: 1 !important; }
#sidebar-v2 nav a .nav-title, #sidebar-v2 nav a .nav-fa-icon, #sidebar-v2 nav a svg { color: var(--ss-minimal-text) !important; }
#sidebar-v2 nav a svg path { stroke: var(--ss-minimal-text) !important; }
#sidebar-v2 nav a img { filter: ${imageFilter} !important; }
#sidebar-v2 nav a.active, #sidebar-v2 nav a.exact-path-active-class, #sidebar-v2 nav a:hover {
  background: color-mix(in srgb, var(--ss-minimal-accent) 12%, var(--ss-minimal-bg)) !important;
}
`;
}

export function assertBrandingSaved(expected: string | null, actual: string | null | undefined) {
  if ((actual || null) !== (expected || null)) throw new Error("Branding wasn't saved correctly. Please try again.");
}