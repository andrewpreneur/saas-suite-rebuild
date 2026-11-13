// Shared checks for the HighLevel theme logo upload.
// The theme-logo function is the only writer. It is not deployed from this change.

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_THEME_LOGOS_PER_AGENCY = 200;

const AGENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const LOCATION_ID = /^[A-Za-z0-9_-]{1,80}$/;
const HTTPS_URL = /^https:\/\/[^\s"'()<>\\]+$/;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|svg|webp)$/;

export type LogoExt = "png" | "jpg" | "webp" | "svg";
export interface SniffedLogo {
  contentType: string;
  ext: LogoExt;
}

export function normalizeAgencyKey(value: unknown): string | null {
  let key = String(value ?? "").trim();
  if (key.toLowerCase().startsWith("agency-")) key = key.slice("agency-".length);
  return AGENCY_KEY.test(key) ? key : null;
}

export function normalizeLocationId(value: unknown): string | null {
  const id = String(value ?? "").trim() || "agency";
  return LOCATION_ID.test(id) ? id : null;
}

export function safeHttpsUrl(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 600 && HTTPS_URL.test(value);
}

export function themeLogoObjectPath(agencyId: string, locationId: string, path: unknown): path is string {
  if (typeof path !== "string" || !path) return false;
  const prefix = `theme/${agencyId}/${locationId}/`;
  return path.startsWith(prefix) && FILE_ID.test(path.slice(prefix.length));
}

function hasBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function sniffSvg(bytes: Uint8Array, declared: string): SniffedLogo | null {
  if (declared && declared !== "image/svg+xml") return null;
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (text.includes("\0")) return null;
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const svgStart = /^(?:<\?xml\s[^>]*>\s*)?<svg[\s>]/i.test(trimmed);
  if (!svgStart) return null;
  if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<embed|<object|<link|<meta|<use[\s>]|javascript:|data:|on[a-z]+\s*=/i.test(trimmed)) {
    return null;
  }
  return { contentType: "image/svg+xml", ext: "svg" };
}

export function sniffLogo(bytes: Uint8Array, declaredType: unknown): SniffedLogo | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > MAX_LOGO_BYTES) return null;
  const declared = String(declaredType ?? "").toLowerCase().split(";")[0].trim();
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    if (declared && declared !== "image/png") return null;
    return { contentType: "image/png", ext: "png" };
  }
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) {
    if (declared && declared !== "image/jpeg" && declared !== "image/jpg") return null;
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  if (hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    if (declared && declared !== "image/webp") return null;
    return { contentType: "image/webp", ext: "webp" };
  }
  return sniffSvg(bytes, declared);
}
