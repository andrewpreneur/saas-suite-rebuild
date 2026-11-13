export type SidebarMode = "light" | "dark";

const LIGHT_TO_DARK =
  "Make sure you switch your branding from light mode to dark mode at the agency settings company level";
const DARK_TO_LIGHT =
  "Make sure you switch your branding from dark mode to light mode at the agency settings company level";

/** Relative luminance. Above 0.45 is a light sidebar, matching the theme customizer. */
export function sidebarLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 1;
  const raw = match[1];
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(raw.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function sidebarModeFromHex(hex: string): SidebarMode {
  return sidebarLuminance(hex) > 0.45 ? "light" : "dark";
}

/**
 * Warning shown when the chosen sidebar mode differs from the last applied one.
 * A light sidebar only warns when the last applied setup was dark.
 * A dark sidebar warns when the last applied setup was light, or nothing is applied yet.
 */
export function sidebarModeWarning(chosen: SidebarMode, applied: SidebarMode | null): string | null {
  if (chosen === applied) return null;
  if (chosen === "dark") return LIGHT_TO_DARK;
  if (chosen === "light" && applied === "dark") return DARK_TO_LIGHT;
  return null;
}
