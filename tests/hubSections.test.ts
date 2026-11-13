import { describe, expect, test } from "bun:test";
import { DEFAULT_HUB_SECTIONS, hubSectionChange, readHubSections, visibleHubDefault, visibleHubSections } from "../src/lib/hubSections";

describe("whole Client Hub sections", () => {
  test("Home can be hidden entirely", () => {
    expect(visibleHubSections(hubSectionChange(DEFAULT_HUB_SECTIONS, "education", "home", false))).toEqual(["education", "support"]);
  });
  test("Education can be hidden entirely", () => {
    expect(hubSectionChange(DEFAULT_HUB_SECTIONS, "home", "education", false).education_page_enabled).toBe(false);
  });
  test("Support can be hidden entirely", () => {
    expect(visibleHubSections(hubSectionChange(DEFAULT_HUB_SECTIONS, "home", "support", false))).toEqual(["home", "education"]);
  });
  test("each visible section can be the default", () => {
    for (const page of ["home", "education", "support"] as const) expect(visibleHubDefault(page, DEFAULT_HUB_SECTIONS)).toBe(page);
  });
  test("hiding the current default selects a visible page in the same write", () => {
    expect(hubSectionChange(DEFAULT_HUB_SECTIONS, "home", "home", false).default_landing_page).toBe("education");
  });
  test("Rob's Help Desk-only configuration lands on Support", () => {
    const sections = { home_page_enabled: false, education_page_enabled: false, support_page_enabled: true };
    expect(visibleHubSections(sections)).toEqual(["support"]);
    expect(visibleHubDefault("home", sections)).toBe("support");
    expect(hubSectionChange(sections, "support", "education", false).default_landing_page).toBe("support");
  });
  test("the last visible section cannot be hidden", () => {
    expect(() => hubSectionChange({ home_page_enabled: false, education_page_enabled: false, support_page_enabled: true }, "support", "support", false)).toThrow("Keep at least one section visible");
  });
  test("existing accounts with missing values retain all three sections", () => {
    expect(readHubSections(null)).toEqual(DEFAULT_HUB_SECTIONS);
  });
});