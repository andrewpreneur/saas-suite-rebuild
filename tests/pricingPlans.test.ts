import { describe, expect, test } from "bun:test";
import {
  SAME_DAY_WL_SUPPORT,
  SAME_DAY_WL_SUPPORT_INFO,
  SAAS_PLANS,
  featureInfoFor,
} from "../src/constants/pricingPlans";

describe("Same Day WL Support", () => {
  test("sits on Advanced immediately after 24/7 team support", () => {
    const features = SAAS_PLANS.advanced.features;
    const support = features.findIndex((feature) => feature.startsWith("24/7 Human Support"));
    expect(support).toBeGreaterThanOrEqual(0);
    expect(features[support + 1]).toBe(SAME_DAY_WL_SUPPORT);
  });

  test("is not a Basic or Premium line item", () => {
    expect(SAAS_PLANS.basic.features).not.toContain(SAME_DAY_WL_SUPPORT);
    expect(SAAS_PLANS.starter.features).not.toContain(SAME_DAY_WL_SUPPORT);
    expect(SAAS_PLANS.premium.features).not.toContain(SAME_DAY_WL_SUPPORT);
    expect(SAAS_PLANS.premium.featureIntro).toBe("Everything in Advanced, plus…");
  });

  test("explains the 24-hour customer answer window", () => {
    expect(featureInfoFor(SAME_DAY_WL_SUPPORT)).toBe(SAME_DAY_WL_SUPPORT_INFO);
    expect(SAME_DAY_WL_SUPPORT_INFO).toBe(
      "We can answer tickets, chats, and questions from your customers within 24 hours.",
    );
  });

  test("does not change plan prices", () => {
    expect(SAAS_PLANS.basic.monthlyPrice).toBe(27);
    expect(SAAS_PLANS.advanced.monthlyPrice).toBe(97);
    expect(SAAS_PLANS.premium.monthlyPrice).toBe(297);
  });
});
