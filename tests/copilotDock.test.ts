import { expect, test } from "bun:test";
import {
  COPILOT_DOCK_DEFAULT,
  COPILOT_DOCK_MAX,
  COPILOT_DOCK_MIN,
  clampDockWidth,
  dockPanelWidth,
  readStoredDockWidth,
} from "../src/lib/copilotDock";

test("the docked Copilot can be resized but never below its minimum or past what the window can spare", () => {
  expect(clampDockWidth(100, 1440)).toBe(COPILOT_DOCK_MIN);
  expect(clampDockWidth(500, 1440)).toBe(500);
  expect(clampDockWidth(5000, 1920)).toBe(COPILOT_DOCK_MAX);
  // 1100px window: at least 640px stays for the sidebar and the page.
  expect(clampDockWidth(700, 1100)).toBe(460);
  expect(clampDockWidth(700, 800)).toBe(COPILOT_DOCK_MIN);
  expect(clampDockWidth(Number.NaN, 1440)).toBe(COPILOT_DOCK_DEFAULT);
});

test("a missing or broken saved width falls back to the default", () => {
  expect(readStoredDockWidth(null)).toBe(COPILOT_DOCK_DEFAULT);
  expect(readStoredDockWidth("abc")).toBe(COPILOT_DOCK_DEFAULT);
  expect(readStoredDockWidth("-5")).toBe(COPILOT_DOCK_DEFAULT);
  expect(readStoredDockWidth("512")).toBe(512);
});

test("the chat menu adds width without pushing the panel off a small window", () => {
  expect(dockPanelWidth(380, 1440, false)).toBe(380);
  expect(dockPanelWidth(380, 1440, true)).toBe(604);
  expect(dockPanelWidth(380, 800, true)).toBeLessThanOrEqual(800 - COPILOT_DOCK_MIN);
});
