import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import {
  MAX_LOGO_BYTES,
  normalizeAgencyKey,
  normalizeLocationId,
  safeHttpsUrl,
  sniffLogo,
  themeLogoObjectPath,
} from "../supabase/functions/_shared/themeLogo";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#112233"/></svg>',
);

describe("theme logo hosting checks", () => {
  test("accepts png, jpeg, webp, and a plain svg", () => {
    expect(sniffLogo(PNG, "image/png")).toEqual({ contentType: "image/png", ext: "png" });
    expect(sniffLogo(JPEG, "image/jpeg")).toEqual({ contentType: "image/jpeg", ext: "jpg" });
    expect(sniffLogo(WEBP, "image/webp")).toEqual({ contentType: "image/webp", ext: "webp" });
    expect(sniffLogo(SVG, "image/svg+xml")?.ext).toBe("svg");
    expect(sniffLogo(PNG, "")?.ext).toBe("png");
  });

  test("rejects a mismatched type, an oversized file, and an svg that can run code", () => {
    expect(sniffLogo(PNG, "image/jpeg")).toBeNull();
    expect(sniffLogo(PNG, "image/svg+xml")).toBeNull();
    const oversized = new Uint8Array(MAX_LOGO_BYTES + 1);
    oversized.set(PNG);
    expect(sniffLogo(oversized, "image/png")).toBeNull();
    const script = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(sniffLogo(script, "image/svg+xml")).toBeNull();
    const handler = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    expect(sniffLogo(handler, "image/svg+xml")).toBeNull();
  });

  test("matches an agency id and keeps storage paths inside that account", () => {
    expect(normalizeAgencyKey("agency-demo-agency")).toBe("demo-agency");
    expect(normalizeAgencyKey("agency-agency-demo")).toBe("agency-demo");
    expect(normalizeAgencyKey("demo-agency")).toBe("demo-agency");
    expect(normalizeAgencyKey("agency-")).toBeNull();
    expect(normalizeAgencyKey("../demo")).toBeNull();
    expect(normalizeLocationId("")).toBe("agency");
    expect(normalizeLocationId("loc-123")).toBe("loc-123");
    expect(normalizeLocationId("loc/123")).toBeNull();
    expect(safeHttpsUrl("https://cdn.example.com/logo.png")).toBe(true);
    expect(safeHttpsUrl("http://cdn.example.com/logo.png")).toBe(false);
    expect(safeHttpsUrl("data:image/png;base64,aaaa")).toBe(false);
    const path = "theme/demo-agency/loc-123/11111111-1111-1111-1111-111111111111.png";
    expect(themeLogoObjectPath("demo-agency", "loc-123", path)).toBe(true);
    expect(themeLogoObjectPath("other-agency", "loc-123", path)).toBe(false);
    expect(themeLogoObjectPath("demo-agency", "loc-123", "logos/someone-else.png")).toBe(false);
  });

  test("the theme panel uploads a file instead of storing a data URL", () => {
    const src = readFileSync(new URL("../public/theme-builder.js", import.meta.url), "utf8");
    expect(src).toContain('data-act="picklogo"');
    expect(src).toContain("data-logo-drop");
    expect(src).toContain("functions/v1/theme-logo");
    expect(src).toContain('body.append("saveToken", proof.saveToken)');
    expect(src).not.toContain("readAsDataURL");
    expect(src).not.toContain("data:image");
  });
});
