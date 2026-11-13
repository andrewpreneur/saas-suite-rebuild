/**
 * One Feature Kit funnel events stored in public.kit_events.
 *
 * Names stay the ones Media Buying already queries. checkout_view is not a
 * separate event name: it is event = 'view' AND step = 'checkout'.
 *
 * view
 *   The step was shown. Fired once for that page load.
 *   The inline script in index.html sends the first view for /one-feature-kit*
 *   (and the kit host) before React loads. React uses the same session id and
 *   view id and does not insert that view again.
 *   checkout view (the checkout_view metric): also skipped when this session
 *   already recorded one in the last 30 seconds. That covers a refresh and a
 *   back/forward remount. A later checkout visit after 30 seconds counts.
 *
 * cta_click
 *   One row per click. On the sales step this is a Get the Kit button.
 *   properties.cta_location is where it sat: hero, mid, final, faq, or sticky.
 *   Other steps still emit cta_click (checkout_submit, ghl_yes, primary) so the
 *   per-step report keeps working.
 *
 * checkout_start
 *   The visitor begins checkout. It fires once per funnel session, on the first
 *   focus or input in the checkout contact fields (name, email, or phone).
 *   If they submit that step without a field event, the submit records the start
 *   instead. It does not fire again on re-render, refresh, or back navigation.
 *   It is not the Stripe session. amount and checkout_session_id are not set here.
 *   The Stripe session id still arrives on later rows (purchase, and the
 *   checkout create request).
 *
 * Why a day can show more checkout views than Get the Kit clicks:
 *   trackKitStepView used to insert a view on every checkout mount with no
 *   memory of the last one. cta_click only runs from a click. A direct
 *   /checkout open, a refresh, or the browser back/forward stack each added a
 *   checkout view and no new click. /one-feature-kit and /one-feature-kit/:step
 *   are separate routes, so arriving on checkout remounts the page and the
 *   effect ran again. Production does not wrap the app in StrictMode, so a
 *   double effect is not what inflated the live counts; the 30s and in-memory
 *   guards cover that case in development too.
 */

export const KIT_VIEW_EVENT = "view" as const;
export const KIT_CHECKOUT_VIEW_STEP = "checkout" as const;

export const KIT_CTA_LOCATIONS = ["hero", "mid", "final", "faq", "sticky", "checkout_submit", "ghl_yes", "primary", "other"] as const;
export type KitCtaLocation = (typeof KIT_CTA_LOCATIONS)[number];

/** Media Buying exclusion once is_test exists. Null and false stay in the report. */
export const KIT_EVENTS_EXCLUDE_TEST_SQL = "e.is_test is not true";
