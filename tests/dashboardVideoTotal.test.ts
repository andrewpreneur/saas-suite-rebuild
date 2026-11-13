import { expect, test } from "bun:test";
import { dashboardVideoTotal } from "../src/components/dashboard/videoTotal";

test("dashboard includes all 31 standard lessons rather than the old 23", () => {
  expect(dashboardVideoTotal(0)).toBe(31);
});

test("dashboard adds every agency custom video to the standard total", () => {
  expect(dashboardVideoTotal(7)).toBe(38);
});