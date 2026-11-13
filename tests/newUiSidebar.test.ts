import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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

test("the old UI stays the default and the switch is limited to platform admins", () => {
  const flag = readFileSync("src/lib/uiVersion.ts", "utf8");
  expect(flag).toContain('getItem(UI_VERSION_STORAGE_KEY) === "new"');
  const control = readFileSync("src/components/UiVersionSwitch.tsx", "utf8");
  expect(control).toContain("isPlatformAdminEmail(actualEmail)");
});
