import { describe, expect, test } from "bun:test";
import { limitUpgradeWidgets, threadHasUpgradeWidget } from "../supabase/functions/chat-copilot/upgradeWidget.ts";

describe("upgrade widget", () => {
  test("keeps a single button and drops it once the thread already showed one", () => {
    const doubled = "Advanced unlocks workflows.\n[[widget:upgrade]]\n[[widget:upgrade]]";
    expect(limitUpgradeWidgets(doubled, false).match(/\[\[widget:upgrade\]\]/g)).toHaveLength(1);
    const prior = [{ role: "assistant", content: "Here is the upgrade.\n[[widget:upgrade]]" }, { role: "user", content: "tell me more" }];
    expect(threadHasUpgradeWidget(prior)).toBe(true);
    expect(limitUpgradeWidgets("One more time.\n[[widget:upgrade]]", true)).toBe("One more time.");
  });
});
