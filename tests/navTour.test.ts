import { describe, expect, test } from "bun:test";
import { buildNavTour } from "../src/components/tips-bot/TipsBotContext";

describe("navigation walkthrough", () => {
  test("steps use the current groups and land on real targets", () => {
    const steps = buildNavTour().map((step) => [step.title, step.targetSelector]);
    expect(steps).toEqual([
      ["Client Hub", "sidebar-section-client-hub"],
      ["Edit Pages", "sidebar-client-hub"],
      ["Client Support", "sidebar-support"],
      ["Resources", "sidebar-section-resources"],
      ["Learning Hub", "sidebar-learning"],
      ["Account", "sidebar-profile"],
      ["Billing", "settings-tab-billing"],
      ["Admins", "settings-tab-admins"],
    ]);
    expect(steps.some((step) => step[0] === "Build" || step[1] === "sidebar-section-build")).toBe(
      false,
    );
    expect(steps.some((step) => step[0] === "Client Hub" && step[1] === "sidebar-client-hub")).toBe(
      false,
    );
  });
});
