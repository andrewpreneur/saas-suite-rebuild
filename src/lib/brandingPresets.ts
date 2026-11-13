import { splitBrandingCSS } from "./brandingSections";

export type BrandingPreset = { id: string; name: string; css: string };

export function readBrandingPresets(value: unknown): BrandingPreset[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BrandingPreset => !!item && typeof item.id === "string" && typeof item.name === "string" && typeof item.css === "string");
}

/** Automatic backups share this name prefix, so only one is kept at a time. */
export const AUTO_PRESET_PREFIX = "Previous setup";

export function isAutoPreset(preset: BrandingPreset): boolean {
  return preset.name.startsWith(AUTO_PRESET_PREFIX);
}

/** Saving under an existing name replaces that preset in place instead of adding a copy. */
export function upsertPreset(presets: BrandingPreset[], preset: BrandingPreset): BrandingPreset[] {
  const key = preset.name.trim().toLowerCase();
  const index = presets.findIndex((item) => item.name.trim().toLowerCase() === key);
  if (index === -1) return [...presets, preset];
  return presets.map((item, i) => (i === index ? preset : item));
}

export function removePreset(presets: BrandingPreset[], id: string): BrandingPreset[] {
  return presets.filter((preset) => preset.id !== id);
}

/**
 * Backs up the live sidebar before it is replaced.
 * Keeps one rolling automatic backup: the new one replaces older automatic
 * backups, and presets the user named are never touched.
 */
export function archiveSidebar(presets: BrandingPreset[], currentCSS: string, nextSidebar: string, id: string, name: string): BrandingPreset[] {
  const currentSidebar = splitBrandingCSS(currentCSS).sidebar.trim();
  if (!currentSidebar || currentSidebar === nextSidebar.trim() || presets.some(p => splitBrandingCSS(p.css).sidebar.trim() === currentSidebar)) return presets;
  return [...presets.filter((preset) => !isAutoPreset(preset)), { id, name, css: currentCSS }];
}