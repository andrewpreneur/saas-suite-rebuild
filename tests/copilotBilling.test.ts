import { describe, expect, test } from "bun:test";
import { UPGRADE_PLANS, accountRank, toolUpgrade, toolArea } from "../supabase/functions/chat-copilot/billingPolicy";
describe("Copilot billing", () => {
  test("Basic costs 27 monthly", () => expect(UPGRADE_PLANS.basic.price).toBe(27));
  test("Advanced costs 97 monthly", () => expect(UPGRADE_PLANS.advanced.price).toBe(97));
  test("Premium Support costs 297 monthly", () => expect(UPGRADE_PLANS.enhanced.price).toBe(297));
  test("Starter branding requires Basic", () => expect(toolUpgrade("update_brand_colors", {}, { plan: "STARTER" })).toBe("basic"));
  test("Starter with a branding purchase can save branding", () => {
    const buyer = { plan: "STARTER", branding_tool_access: true };
    expect(toolUpgrade("update_brand_colors", {}, buyer)).toBeNull();
    expect(toolUpgrade("update_custom_css", {}, buyer)).toBeNull();
  });
  test("Basic branding is allowed", () => expect(toolUpgrade("update_custom_css", {}, { plan: "BASIC" })).toBeNull());
  test("Starter AI support requires Basic", () => expect(toolUpgrade("toggle_ai_chat", { enabled: true }, { plan: "STARTER" })).toBe("basic"));
  test("a branding purchase does not unlock AI support or workflows", () => {
    const buyer = { plan: "STARTER", branding_tool_access: true };
    expect(toolUpgrade("toggle_ai_chat", { enabled: true }, buyer)).toBe("basic");
    expect(toolUpgrade("update_ai_config", {}, buyer)).toBe("basic");
    expect(toolUpgrade("configure_workflow", {}, buyer)).toBe("advanced");
  });
  test("Basic workflows require Advanced", () => expect(toolUpgrade("configure_workflow", {}, { plan: "BASIC" })).toBe("advanced"));
  test("installation and onboarding do not require a purchase", () => {
    for (const tool of ["get_plan_urls", "set_checklist_items", "update_welcome_text", "human_handover"]) expect(toolUpgrade(tool, {}, { plan: "STARTER" })).toBeNull();
  });
  test("Premium Support is Advanced plus a support flag", () => expect(accountRank({ plan: "ADVANCED", premium_support: true })).toBe(3));
  test("Advanced can upgrade to Premium Support", () => expect(accountRank({ plan: "ADVANCED" })).toBeLessThan(UPGRADE_PLANS.enhanced.rank));
  test("billing and branding respect separate admin permissions", () => {
    expect(toolArea("start_upgrade")).toBe("settings");
    expect(toolArea("update_custom_css")).toBe("branding");
  });
});