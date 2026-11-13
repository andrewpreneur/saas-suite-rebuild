import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decideSubscriptionPlan, planRank } from "../supabase/functions/_shared/planRank.ts";

describe("subscription plan rank", () => {
  test("matches reconcile-plans: STARTER < BASIC < ADVANCED", () => {
    expect(planRank("STARTER")).toBe(0);
    expect(planRank("BASIC")).toBe(1);
    expect(planRank("ADVANCED")).toBe(2);
    expect(planRank("advanced")).toBe(2);
  });

  test("a Basic Stripe event does not replace Advanced", () => {
    const decision = decideSubscriptionPlan({
      currentPlan: "ADVANCED",
      incomingPlan: "BASIC",
      currentMax: 10000,
    });
    expect(decision).toEqual({
      action: "skip_downgrade",
      kept: "ADVANCED",
      ignored: "BASIC",
      liveBelowKept: false,
      maxUsers: 10000,
    });
  });

  test("a Starter price does not replace Advanced", () => {
    const decision = decideSubscriptionPlan({
      currentPlan: "ADVANCED",
      incomingPlan: "STARTER",
      currentMax: 10000,
    });
    expect(decision.action).toBe("skip_downgrade");
    if (decision.action === "skip_downgrade") expect(decision.kept).toBe("ADVANCED");
  });

  test("Basic still raises a Starter account and its seat count", () => {
    expect(decideSubscriptionPlan({
      currentPlan: "STARTER",
      incomingPlan: "BASIC",
      currentMax: 1,
    })).toEqual({ action: "raise", plan: "BASIC", maxUsers: 5 });
  });

  test("Advanced raises Basic and does not lower an already higher seat count", () => {
    expect(decideSubscriptionPlan({
      currentPlan: "BASIC",
      incomingPlan: "ADVANCED",
      currentMax: 10000,
    })).toEqual({ action: "raise", plan: "ADVANCED", maxUsers: 10000 });
    const higher = decideSubscriptionPlan({
      currentPlan: "BASIC",
      incomingPlan: "ADVANCED",
      currentMax: 25000,
    });
    expect(higher).toEqual({ action: "raise", plan: "ADVANCED", maxUsers: 25000 });
  });

  test("the same plan only fills a short seat count", () => {
    expect(decideSubscriptionPlan({
      currentPlan: "ADVANCED",
      incomingPlan: "ADVANCED",
      currentMax: 10000,
    })).toEqual({ action: "same", maxUsers: null });
    expect(decideSubscriptionPlan({
      currentPlan: "BASIC",
      incomingPlan: "BASIC",
      currentMax: 2,
    })).toEqual({ action: "same", maxUsers: 5 });
  });

  test("a past-due Starter row still remembers Advanced when a Basic price arrives", () => {
    const decision = decideSubscriptionPlan({
      currentPlan: "STARTER",
      protectedPlan: "ADVANCED",
      incomingPlan: "BASIC",
      currentMax: 1,
    });
    expect(decision).toMatchObject({
      action: "skip_downgrade",
      kept: "ADVANCED",
      ignored: "BASIC",
      liveBelowKept: true,
    });
  });
});

describe("stripe subscription webhook", () => {
  const source = readFileSync("supabase/functions/stripe-subscription-webhook/index.ts", "utf8");

  test("skips a downgrade before it writes the plan or calls restore_user_access", () => {
    const decision = source.indexOf("decideSubscriptionPlan(");
    const skip = source.indexOf('decision.action === "skip_downgrade"');
    const log = source.indexOf("skipped downgrade");
    const restore = source.indexOf("restore_user_access");
    expect(decision).toBeGreaterThan(0);
    expect(skip).toBeGreaterThan(decision);
    expect(log).toBeGreaterThan(skip);
    expect(restore).toBeGreaterThan(log);
    expect(source.slice(skip, restore)).toContain("return endTracked");
    expect(source.slice(skip, restore)).not.toContain("plan: newPlan");
  });
});
