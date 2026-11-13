import { describe, expect, test } from "bun:test";
import { LEARNING_HUB_PATH, onboardingArrivalAction } from "../src/lib/onboardingArrival";

const pending = { needsLanding: true, alreadyHandled: false };

describe("onboarding arrival", () => {
  test("unfinished accounts land on the Learning Hub", () => {
    expect(LEARNING_HUB_PATH).toBe("/app/learning");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app" })).toBe("learning");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/dashboard" })).toBe("learning");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/streamline" })).toBe("learning");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/copilot" })).toBe("learning");
  });

  test("the Learning Hub itself only opens Copilot", () => {
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/learning" })).toBe("open");
  });

  test("finished accounts, admins, and a second page in the same visit stay put", () => {
    expect(onboardingArrivalAction({ needsLanding: false, pathname: "/app/dashboard" })).toBe("stay");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/dashboard", alreadyHandled: true })).toBe("stay");
  });

  test("the wizard URL, kit steps, and tab hand-offs stay reachable", () => {
    expect(onboardingArrivalAction({ ...pending, pathname: "/v2-onboarding" })).toBe("stay");
    expect(onboardingArrivalAction({ ...pending, pathname: "/initial-questions" })).toBe("stay");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/dashboard", search: "?view=kit" })).toBe("stay");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app/dashboard", search: "?view=affiliate" })).toBe("stay");
    expect(onboardingArrivalAction({ ...pending, pathname: "/app", search: "?tab=walkthrough" })).toBe("stay");
    expect(onboardingArrivalAction({ ...pending, pathname: "/login" })).toBe("stay");
  });
});
