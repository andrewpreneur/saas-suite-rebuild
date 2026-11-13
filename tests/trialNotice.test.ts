import { expect, test } from "bun:test";
import { KIT_BASIC_TRIAL_SOURCE, MANUAL_BASIC_TRIAL_SOURCE, kitBasicTrialEnd, shouldShowCancellationNotice } from "../src/lib/trialNotice";

test("a free 30-day Basic trial is not a canceled subscription", () => {
  expect(shouldShowCancellationNotice("manual_basic_30day")).toBe(false);
  expect(shouldShowCancellationNotice(KIT_BASIC_TRIAL_SOURCE)).toBe(false);
  expect(MANUAL_BASIC_TRIAL_SOURCE).toBe("manual_basic_30day");
  const start = "2026-10-20T18:03:13.000Z";
  expect(kitBasicTrialEnd(start, 30)?.toISOString()).toBe("2026-11-19T18:03:13.000Z");
});

test("ordinary canceled subscriptions still display their notice", () => {
  expect(shouldShowCancellationNotice(null)).toBe(true);
  expect(shouldShowCancellationNotice("stripe_trial")).toBe(true);
});