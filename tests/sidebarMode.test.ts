import { describe, expect, test } from "bun:test";
import { sidebarModeFromHex, sidebarModeWarning } from "../src/lib/sidebarMode";

describe("Design page sidebar mode warning", () => {
  test("requires the light-to-dark note for a dark sidebar that is not already applied", () => {
    expect(sidebarModeFromHex("#0E1A3A")).toBe("dark");
    expect(sidebarModeFromHex("#FFFFFF")).toBe("light");
    expect(sidebarModeFromHex("#FAFAF8")).toBe("light");
    expect(sidebarModeWarning("dark", null)).toBe(
      "Make sure you switch your branding from light mode to dark mode at the agency settings company level",
    );
    expect(sidebarModeWarning("dark", "light")).toContain("from light mode to dark mode");
    expect(sidebarModeWarning("dark", "dark")).toBeNull();
  });

  test("requires the reverse note only when a light sidebar replaces a dark one", () => {
    expect(sidebarModeWarning("light", "dark")).toBe(
      "Make sure you switch your branding from dark mode to light mode at the agency settings company level",
    );
    expect(sidebarModeWarning("light", null)).toBeNull();
    expect(sidebarModeWarning("light", "light")).toBeNull();
  });
});
