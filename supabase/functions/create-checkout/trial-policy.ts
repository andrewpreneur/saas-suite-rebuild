export const TRAINING_TRIAL_SOURCE = "onefeature_training_14day";
export const WEBINAR_TRIAL_SOURCE = "webinar_registrant_14day";
export const CODE_TRIAL_SOURCE = "aisaas_code_14day";
/** Public /copilot visitors: 3-day card-required trial of $27 Basic or $97 Advanced. */
export const PUBLIC_COPILOT_TRIAL_SOURCE = "public_copilot_3day";
export const TRIAL_DAYS = 14;
export function trialDaysFor(source: unknown): number {
  return source === PUBLIC_COPILOT_TRIAL_SOURCE ? 3 : TRIAL_DAYS;
}
// `now` stays so callers can pass the request time. Webinar registrants are not cut off by date.
export function trialError(
  source: unknown,
  plan: unknown,
  email: string | undefined,
  _now: number,
) {
  if (
    source !== TRAINING_TRIAL_SOURCE &&
    source !== WEBINAR_TRIAL_SOURCE &&
    source !== CODE_TRIAL_SOURCE &&
    source !== PUBLIC_COPILOT_TRIAL_SOURCE
  )
    return "This trial isn't available.";
  if (
    source === PUBLIC_COPILOT_TRIAL_SOURCE
      ? plan !== "basic" && plan !== "advanced"
      : plan !== "advanced"
  )
    return "This trial isn't available.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Enter a valid email to claim your free trial.";
  return null;
}
