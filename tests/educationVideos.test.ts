import { describe, expect, test } from "bun:test";
import { VIDEO_CATEGORIES } from "../src/constants/videoCategories";
import { EDUCATION_MODULES, resolveLinkedVideo } from "../supabase/functions/chat-copilot/educationVideos";

describe("education video links", () => {
  test("copilot catalog matches every catalogue lesson, including domain and profile", () => {
    const catalog = new Set(EDUCATION_MODULES.map((item) => `${item.categoryId}:${item.moduleId}`));
    for (const category of VIDEO_CATEGORIES) {
      for (const module of category.modules) {
        expect(catalog.has(`${category.id}:${module.id}`)).toBe(true);
      }
    }
    expect(EDUCATION_MODULES).toHaveLength(
      VIDEO_CATEGORIES.reduce((count, category) => count + category.modules.length, 0),
    );
    expect(catalog.has("website-content:connect-domain")).toBe(true);
    expect(catalog.has("foundational-setup:configure-profile-billing")).toBe(true);
    expect(catalog.has("foundational-setup:mobile-app")).toBe(true);
  });

  test("domain setup resolves to the website lesson, not appointments", () => {
    expect(resolveLinkedVideo("connect-domain")).toEqual({ ok: true, value: "website-content:connect-domain" });
    expect(resolveLinkedVideo("website-content:connect-domain")).toEqual({
      ok: true,
      value: "website-content:connect-domain",
    });
    expect(resolveLinkedVideo("scheduling")).toEqual({ ok: true, value: "foundational-setup:scheduling" });
    const domains = resolveLinkedVideo("domains");
    expect(domains.ok).toBe(false);
  });

  test("unknown ids are rejected and custom ids pass through", () => {
    const extra = new Set(["11111111-1111-1111-1111-111111111111"]);
    expect(resolveLinkedVideo("11111111-1111-1111-1111-111111111111", extra)).toEqual({
      ok: true,
      value: "11111111-1111-1111-1111-111111111111",
    });
    expect(resolveLinkedVideo("branding").ok).toBe(false);
    expect(resolveLinkedVideo("").ok).toBe(false);
  });

  test("mobile app uses the hub player id so the step can expand", () => {
    expect(resolveLinkedVideo("mobile-app")).toEqual({
      ok: true,
      value: "foundational-setup:mobile-app-walkthrough",
    });
    expect(resolveLinkedVideo("foundational-setup:mobile-app")).toEqual({
      ok: true,
      value: "foundational-setup:mobile-app-walkthrough",
    });
  });
});
