import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  NEW_UI_SIDEBAR_SECTIONS,
  SIDEBAR_HOME_TOOL_IDS,
  SIDEBAR_SECTIONS,
} from "../src/lib/sidebarNav";

test("the new-UI sidebar keeps every link the old sidebar has, each listed once", () => {
  const oldIds = [...SIDEBAR_HOME_TOOL_IDS, ...SIDEBAR_SECTIONS.flatMap((section) => section.toolIds)];
  const newIds = [
    ...SIDEBAR_HOME_TOOL_IDS,
    ...NEW_UI_SIDEBAR_SECTIONS.flatMap((section) => section.toolIds),
  ];
  for (const id of oldIds) expect(newIds).toContain(id);
  expect(new Set(newIds).size).toBe(newIds.length);
});

test("every new-UI sidebar link is a tool the sidebar knows how to render", () => {
  const sidebar = readFileSync("src/components/AppSidebar.tsx", "utf8");
  for (const section of NEW_UI_SIDEBAR_SECTIONS) {
    expect(section.label.length).toBeGreaterThan(0);
    for (const id of section.toolIds) expect(sidebar).toContain(`{ id: "${id}"`);
  }
});

test("the rebuild has one UI: no old-UI switch and no legacy components", () => {
  expect(readFileSync("src/lib/uiVersion.ts", "utf8")).toContain("export const newUi = true");
  expect(existsSync("src/components/UiVersionSwitch.tsx")).toBe(false);
  expect(existsSync("src/components/ui/legacy")).toBe(false);
});
