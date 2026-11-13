import { expect, test } from "bun:test";
import {
  TRIAL_DAYS,
  WEBINAR_TRIAL_SOURCE,
  trialDaysFor,
  trialError,
} from "../supabase/functions/create-checkout/trial-policy";

const OLD_WEBINAR_CUTOFF = Date.parse("2026-10-07T14:00:00-05:00");
const AFTER_OLD_CUTOFF = Date.parse("2026-10-09T16:37:00Z");
const PAID_TRAFFIC_ATTEMPT = Date.parse("2026-10-21T17:13:00-05:00");

test("training Advanced trial is available after the old webinar deadline", () => {
  expect(
    trialError("onefeature_training_14day", "advanced", "test@example.com", AFTER_OLD_CUTOFF),
  ).toBeNull();
});
test("training trial cannot unlock a different plan", () => {
  expect(trialError("onefeature_training_14day", "basic", "test@example.com", Date.now())).toBe(
    "This trial isn't available.",
  );
});
test("trial requires an email for server-side reuse checks", () => {
  expect(trialError("onefeature_training_14day", "advanced", undefined, Date.now())).toBe(
    "Enter a valid email to claim your free trial.",
  );
});
test("webinar registrant trial has no calendar cutoff", () => {
  expect(
    trialError(WEBINAR_TRIAL_SOURCE, "advanced", "test@example.com", OLD_WEBINAR_CUTOFF - 1),
  ).toBeNull();
  expect(
    trialError(WEBINAR_TRIAL_SOURCE, "advanced", "test@example.com", OLD_WEBINAR_CUTOFF),
  ).toBeNull();
  expect(
    trialError(WEBINAR_TRIAL_SOURCE, "advanced", "test@example.com", AFTER_OLD_CUTOFF),
  ).toBeNull();
  expect(
    trialError(WEBINAR_TRIAL_SOURCE, "advanced", "registrant@example.com", PAID_TRAFFIC_ATTEMPT),
  ).toBeNull();
  expect(
    trialError(
      WEBINAR_TRIAL_SOURCE,
      "advanced",
      "test@example.com",
      Date.parse("2027-01-01T00:00:00Z"),
    ),
  ).toBeNull();
});
test("webinar registrant trial stays 14 days on Advanced only", () => {
  expect(TRIAL_DAYS).toBe(14);
  expect(trialDaysFor(WEBINAR_TRIAL_SOURCE)).toBe(14);
  expect(trialError(WEBINAR_TRIAL_SOURCE, "basic", "test@example.com", PAID_TRAFFIC_ATTEMPT)).toBe(
    "This trial isn't available.",
  );
  expect(
    trialError(WEBINAR_TRIAL_SOURCE, "enhanced", "test@example.com", PAID_TRAFFIC_ATTEMPT),
  ).toBe("This trial isn't available.");
  expect(trialError(WEBINAR_TRIAL_SOURCE, "advanced", undefined, PAID_TRAFFIC_ATTEMPT)).toBe(
    "Enter a valid email to claim your free trial.",
  );
  expect(trialError(WEBINAR_TRIAL_SOURCE, "advanced", "not-an-email", PAID_TRAFFIC_ATTEMPT)).toBe(
    "Enter a valid email to claim your free trial.",
  );
  expect(trialError("unknown_trial", "advanced", "test@example.com", PAID_TRAFFIC_ATTEMPT)).toBe(
    "This trial isn't available.",
  );
});
test("AISAAS code trial works only on the $97 plan", () => {
  expect(trialError("aisaas_code_14day", "advanced", "test@example.com", Date.now())).toBeNull();
  expect(trialError("aisaas_code_14day", "basic", "test@example.com", Date.now())).toBe(
    "This trial isn't available.",
  );
});
