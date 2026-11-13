import { GHL_AFFILIATE_SIGNUP_URL } from "@/constants/ghlAffiliate";

export type OneFeaturePlan = "none" | "97" | "297" | "497";
export const ONE_FEATURE_TRIAL_SOURCE = "onefeature_training_14day";
/** After a One-Feature trial checkout, send the buyer to book their setup call. */
export const ONE_FEATURE_TRIAL_REDIRECT = "/success?trial=started";
export function oneFeatureDestination(plan: OneFeaturePlan) {
  // Visitors without a HighLevel account get Russell's signup link. Every HighLevel plan gets the SaaSSuite trial.
  // /onefeaturetraining-5 uses this only for the no-account step. Its has-account step does not open checkout.
  if (plan === "none") return { kind: "affiliate", url: GHL_AFFILIATE_SIGNUP_URL } as const;
  return { kind: "checkout", plan: "advanced", trialSource: ONE_FEATURE_TRIAL_SOURCE } as const;
}
