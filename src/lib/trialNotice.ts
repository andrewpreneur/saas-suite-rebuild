export const MANUAL_BASIC_TRIAL_SOURCE = "manual_basic_30day";
export const KIT_BASIC_TRIAL_SOURCE = "one_feature_kit_30day";
export const KIT_BASIC_TRIAL_DAYS = 30;

export function shouldShowCancellationNotice(trialSource: string | null | undefined) {
  return trialSource !== MANUAL_BASIC_TRIAL_SOURCE && trialSource !== KIT_BASIC_TRIAL_SOURCE;
}

/** End of a kit Basic grant. Staff trials use cancel_access_until instead. */
export function kitBasicTrialEnd(start: string | null | undefined, length: number | null | undefined): Date | null {
  if (!start) return null;
  const parsed = new Date(start).getTime();
  if (Number.isNaN(parsed)) return null;
  const days = length && length > 0 ? length : KIT_BASIC_TRIAL_DAYS;
  return new Date(parsed + days * 86_400_000);
}