/** Webinar confirmation checkout. Kept here so the trial page and Stripe metadata use one marker. */
export const WEBINAR_REGISTRANT_TRIAL_SOURCE = "webinar_registrant_14day";

/**
 * Add webinar context beside the visitor's first-touch UTMs.
 * utm_source and utm_campaign stay as captured (for example Facebook), so the
 * confirmation page does not replace the campaign that brought the registrant.
 */
export function checkoutAttributionForTrial(
  attribution: Record<string, string>,
  trialSource?: string,
): Record<string, string> {
  if (trialSource !== WEBINAR_REGISTRANT_TRIAL_SOURCE) return attribution;
  return {
    ...attribution,
    offer: "registrant-trial",
    entry_point: "webinar-confirmation",
  };
}
