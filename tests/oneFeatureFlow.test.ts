import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GHL_AFFILIATE_SIGNUP_URL, GHL_AFFILIATE_TRIAL_URL, GHL_UPGRADE_297_URL, GHL_UPGRADE_497_URL } from "../src/constants/ghlAffiliate";
import { UPGRADE_297_URL, UPGRADE_497_URL } from "../src/components/one-feature/shared";
import { GHL_AFFILIATE_SIGNUP_URL as funnelSignupUrl } from "../src/funnel/one-feature-kit/order";
import { oneFeatureDestination, ONE_FEATURE_TRIAL_REDIRECT } from "../src/lib/oneFeatureFlow";
const trial = { kind: "checkout", plan: "advanced", trialSource: "onefeature_training_14day" };
const RUSSELL_URL = "https://www.gohighlevel.com/?fp_ref=crm-pricing-reviews&fp_sid=Russell-Andrew";
const TRAINING_TRIAL_URL = "https://www.gohighlevel.com/?fp_ref=andrewgeorge";
test("no-account button on the ad pages uses Russell's signup link", () => {
  expect(GHL_AFFILIATE_TRIAL_URL).toBe(TRAINING_TRIAL_URL);
  expect(GHL_AFFILIATE_SIGNUP_URL).toBe(RUSSELL_URL);
  expect(oneFeatureDestination("none")).toEqual({ kind: "affiliate", url: GHL_AFFILIATE_SIGNUP_URL });
  const page = readFileSync("src/pages/OneFeatureStrategy.tsx", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");
  expect(page).toContain('destination.kind === "affiliate"');
  expect(page).toContain('href={destination.url}');
  expect(page).toContain("Start My FREE GHL Trial");
  expect(page).not.toContain("GHL_AFFILIATE_TRIAL_URL");
  expect(page).not.toContain("andrewgeorge");
  expect(app).toContain('path="/onefeaturetraining-3" element={<OneFeatureStrategy variant={3} />}');
  expect(app).toContain('path="/onefeaturetraining-4" element={<OneFeatureStrategy variant={4} />}');
  expect(app).toContain('path="/onefeaturetraining-5" element={<OneFeatureStrategy variant={5} />}');
  expect(app.match(/<OneFeatureStrategy\b/g)).toEqual([
    "<OneFeatureStrategy",
    "<OneFeatureStrategy",
    "<OneFeatureStrategy",
  ]);
});
test("kit upgrade links use Russell and the One Feature pages keep andrewgeorge", () => {
  expect(GHL_UPGRADE_297_URL).toBe("https://www.gohighlevel.com/297upgrade?fp_ref=crm-pricing-reviews&fp_sid=Russell-Andrew");
  expect(GHL_UPGRADE_497_URL).toBe("https://www.gohighlevel.com/saasupgrade?fp_ref=crm-pricing-reviews&fp_sid=Russell-Andrew");
  expect(UPGRADE_297_URL).toBe("https://www.gohighlevel.com/297upgrade?fp_ref=andrewgeorge");
  expect(UPGRADE_497_URL).toBe("https://www.gohighlevel.com/saasupgrade?fp_ref=andrewgeorge");
  expect(GHL_AFFILIATE_TRIAL_URL).toBe(TRAINING_TRIAL_URL);
});
test("kit signup uses the Russell HighLevel affiliate link", () => {
  expect(GHL_AFFILIATE_SIGNUP_URL).toBe(RUSSELL_URL);
  expect(funnelSignupUrl).toBe(GHL_AFFILIATE_SIGNUP_URL);
  const lead = readFileSync("supabase/functions/one-feature-lead/index.ts", "utf8");
  expect(lead).not.toContain("gohighlevel.com");
  expect(lead).not.toContain("fp_ref");
});
test("97 plan gets the SaaSSuite trial, not an upgrade link", () => {
  expect(oneFeatureDestination("97")).toEqual(trial);
});
test("297 plan gets the SaaSSuite trial, not an upgrade link", () => {
  expect(oneFeatureDestination("297")).toEqual(trial);
});
test("497 plan gets the SaaSSuite trial", () => {
  expect(oneFeatureDestination("497")).toEqual(trial);
});
test("trial buyers are sent to book a success call", () => {
  expect(ONE_FEATURE_TRIAL_REDIRECT).toBe("/success?trial=started");
});
