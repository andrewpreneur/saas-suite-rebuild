// Shared checks for HighLevel location themes.
// location-theme is the only writer. A claimed type or role does not authorize a save.
// hintUserId and hintUserEmail only clean a value the server has already verified.

import { normalizeAgencyKey, normalizeLocationId, safeHttpsUrl } from "./themeLogo.ts";

export const MAX_LOCATION_THEMES_PER_AGENCY = 500;
export const MAX_THEME_BYTES = 24_000;

const HEX = /^#[0-9A-F]{6}$/;
const FONT = /^[a-zA-Z0-9 -]{1,60}$/;
const ICON_PACKS = new Set(["default", "lucide", "phosphor", "tabler", "phosphor-duotone"]);
const USER_ID = /^[A-Za-z0-9_@.+-]{1,80}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COLOR_KEYS = ["sidebarBg", "sidebarBgEnd", "sidebarText", "accent", "accentText", "headerBg"] as const;

export { normalizeAgencyKey, normalizeLocationId };

function cleanHint(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.includes("{{")) return "";
  return text;
}

export function claimedThemeEditor(type: unknown, role: unknown): boolean {
  const userType = cleanHint(type).toLowerCase();
  const userRole = cleanHint(role).toLowerCase();
  return userType === "agency" || userRole === "admin";
}

export function hintUserId(value: unknown): string | null {
  const id = cleanHint(value);
  return USER_ID.test(id) ? id : null;
}

export function hintUserEmail(value: unknown): string | null {
  const email = cleanHint(value).toLowerCase();
  return email.length <= 320 && EMAIL.test(email) ? email : null;
}

export function sanitizeLocationTheme(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (raw.ghlDefault === true) return { ghlDefault: true };
  if (raw.inheritAgency === true) return { inheritAgency: true };

  const out: Record<string, unknown> = {};
  for (const key of COLOR_KEYS) {
    if (typeof raw[key] === "string" && HEX.test(raw[key].toUpperCase())) out[key] = raw[key].toUpperCase();
  }
  if (typeof raw.font === "string" && FONT.test(raw.font)) out.font = raw.font;
  if (raw.fontScope === "app" || raw.fontScope === "sidebar" || raw.fontScope === "none") out.fontScope = raw.fontScope;
  if (typeof raw.iconPack === "string" && ICON_PACKS.has(raw.iconPack)) out.iconPack = raw.iconPack;
  if (raw.logoUrl === "" || safeHttpsUrl(raw.logoUrl)) out.logoUrl = raw.logoUrl;
  if (typeof raw.logoHeight === "number" && raw.logoHeight >= 20 && raw.logoHeight <= 90) out.logoHeight = Math.round(raw.logoHeight);
  if (typeof raw.radius === "number" && raw.radius >= 0 && raw.radius <= 20) out.radius = Math.round(raw.radius);
  if (typeof raw.appAccent === "boolean") out.appAccent = raw.appAccent;
  if (typeof raw.motion === "boolean") out.motion = raw.motion;
  if (typeof raw.customSurface === "boolean") out.customSurface = raw.customSurface;
  if (typeof raw.name === "string" && raw.name.trim()) out.name = raw.name.trim().slice(0, 40);
  if (raw.icons && typeof raw.icons === "object" && !Array.isArray(raw.icons)) {
    const icons: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.icons as Record<string, unknown>)) {
      if (!/^[a-z0-9:-]{2,60}$/.test(key) || typeof value !== "string" || value.length > 200) continue;
      if (value.startsWith("https://")) {
        if (!safeHttpsUrl(value)) continue;
      } else if (!/^[a-z0-9:-]+$/.test(value)) continue;
      icons[key] = value;
    }
    if (Object.keys(icons).length) out.icons = icons;
  }
  if (!Object.keys(out).length) return null;
  if (JSON.stringify(out).length >= MAX_THEME_BYTES) return null;
  return out;
}
