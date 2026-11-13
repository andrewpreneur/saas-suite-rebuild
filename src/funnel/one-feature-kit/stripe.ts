/**
 * Stripe catalog for the One Feature Kit.
 *
 * Lovable creates one Stripe Product per row and pastes the Price ID into
 * `stripePriceId`. Checkout does not charge while `ONE_FEATURE_KIT_PAYMENTS_LIVE`
 * is false, or while any Price ID is empty.
 *
 * Where each Price ID is used:
 * - kit, bump-replay, bump-video, bump-install: one Checkout Session on
 *   /checkout. Unticked bumps are omitted. Do not reuse create-checkout; that
 *   function charges live SaaSSuite subscription prices.
 * - launch and webinar-system are one-time charges on the card saved by that
 *   session, fired only when the buyer clicks Yes on that page.
 * - /ghl-signup-and-upgrade does not charge.
 *
 * There is no subscription in this funnel.
 *
 * After Stripe confirms the money, the server (not the browser) calls
 * `one-feature-kit-purchase-notify`. That function posts through the existing
 * `slack-notify` function. `KIT_SLACK_AGENCY_ID` is the agency whose Slack
 * install receives the ping. The edge secret must be set to the same value.
 */

export type KitPriceType = "one_time";

export type KitStripeProduct = {
  id: string;
  name: string;
  amountCents: number;
  type: KitPriceType;
  /** Paste the Stripe Price ID here. Empty means checkout must stay off. */
  stripePriceId: string;
  chargedOn: string;
};

export const KIT_STRIPE_PRODUCTS: KitStripeProduct[] = [
  {
    id: "kit",
    name: "The GoHighLevel One Feature Kit",
    amountCents: 2700,
    type: "one_time",
    stripePriceId: "price_1USVOKGdZ9PRE3ZiXErcyWvf",
    chargedOn: "Checkout session, always included.",
  },
  {
    id: "bump-replay",
    name: "Full 90-Minute Training Replay",
    amountCents: 1700,
    type: "one_time",
    stripePriceId: "price_1USVOeGdZ9PRE3Zi0JATCT1f",
    chargedOn: "Checkout session, only when the $17 replay bump is ticked.",
  },
  {
    id: "bump-video",
    name: "Done-For-You Branded AI Studio Sales Video",
    amountCents: 2700,
    type: "one_time",
    stripePriceId: "price_1USVOrGdZ9PRE3ZiTX97C44L",
    chargedOn: "Checkout session, only when the $27 branded video bump is ticked.",
  },
  {
    id: "bump-install",
    name: "DFY Installation, Customization, and Setup",
    amountCents: 29900,
    type: "one_time",
    stripePriceId: "price_1USVPBGdZ9PRE3ZiUKYp131V",
    chargedOn: "Checkout session, only when the $299 setup bump is ticked.",
  },
  {
    id: "launch",
    name: "25 white-labeled ad templates",
    amountCents: 14700,
    type: "one_time",
    stripePriceId: "price_1USVPMGdZ9PRE3ZiquzhQOrn",
    chargedOn: "Yes on /launch-pack.",
  },
  {
    id: "webinar-system",
    name: "Webinar Sales System",
    amountCents: 9700,
    type: "one_time",
    stripePriceId: "price_1USVPYGdZ9PRE3ZidArTr362",
    chargedOn: "Yes on /webinar-sales-system.",
  },
];

/**
 * Agency id whose installed Slack channel receives kit purchase pings
 * via slack-notify. The edge secret KIT_SLACK_AGENCY_ID must be the same value.
 */
export const KIT_SLACK_AGENCY_ID = "saassuite";

export function missingKitPriceIds(
  products: KitStripeProduct[] = KIT_STRIPE_PRODUCTS,
): string[] {
  return products.filter((product) => !product.stripePriceId).map((product) => product.id);
}
