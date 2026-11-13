import { describe, expect, test } from "bun:test";
import { ALL_TIPS, V3_TIPS, buildNavTour, buildWalkthrough } from "../src/components/tips-bot/TipsBotContext";

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
      ["Connect HighLevel", "settings-tab-highlevel"],
    ]);
    expect(steps.some((step) => step[0] === "Build" || step[1] === "sidebar-section-build")).toBe(
      false,
    );
    expect(steps.some((step) => step[0] === "Client Hub" && step[1] === "sidebar-client-hub")).toBe(
      false,
    );
  });

  test("every walkthrough ends on the HighLevel row and finishes on the connection page", () => {
    const lists = [buildNavTour(), buildWalkthrough(true), buildWalkthrough(false), ALL_TIPS, V3_TIPS];
    for (const list of lists) {
      const last = list[list.length - 1];
      expect(last.title).toBe("Connect HighLevel");
      expect(last.targetSelector).toBe("settings-tab-highlevel");
      expect(last.navigation?.selectTool).toBe("settings");
      expect(last.navigation?.finishPath).toBe("/app/highlevel");
      expect(list.filter((step) => step.navigation?.finishPath).length).toBe(1);
    }
  });
});
