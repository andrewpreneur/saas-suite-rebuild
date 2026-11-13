# Annual pricing and complete plan presentation

## Goal
Update every active SaaSSuite pricing surface without changing unrelated pages, current subscriptions, or existing monthly Stripe prices.

## User-facing changes
- Add a Monthly / Annual selector above SaaSSuite pricing, defaulting to Annual, with a “Save 25%” badge.
- Show annual prices as monthly equivalents with yearly totals:
  - Basic: $20/mo, billed yearly at $240/yr
  - Advanced: $72.50/mo, billed yearly at $870/yr
  - Premium Support: $222.50/mo, billed yearly at $2,670/yr
- Keep monthly pricing unchanged at Free, $27, $97, and $297, with “Billed monthly · Cancel anytime.”
- Keep Starter free in both views and preserve the Advanced / Premium Support selector in both views.
- Add “No contracts. No hidden fees.” prominently near the pricing selector.
- Apply the complete requested Advanced and Premium Support taglines and feature lists; add the RECOMMENDED badge to Premium Support.
- Match the existing visual style and keep cards stacked without horizontal scrolling on mobile.

## Pricing surfaces
- Replace duplicated plan copy with one shared SaaSSuite plan definition and reusable pricing-card presentation.
- Use it on the homepage, `/pricing`, the in-account billing/settings area, and the upgrade dialog.
- Update the test pricing page only where needed to prevent stale prices from appearing.
- Ensure the in-account billing area explicitly includes Premium Support at $297 monthly and $2,670 yearly.
- Leave non-SaaSSuite offers, full-build services, agency pricing, and native RevenueCat purchasing behavior unchanged.

## Stripe changes
- Create one new live yearly recurring price on each existing Stripe product—Basic $240/year, Advanced $870/year, and Premium Support $2,670/year.
- Do not create duplicate products, and do not modify, deactivate, or delete any existing price.
- Wire each Subscribe button to the selected monthly or annual price.
- Preserve existing checkout behavior, promotions, attribution, and embedded checkout.

## Access and billing safety
- Add the new annual price IDs to checkout, subscription webhook access mapping, reconciliation, cancellation handling, purchase fulfillment, and plan labeling.
- Annual Basic grants Basic; annual Advanced grants Advanced; annual Premium Support grants Advanced plus Premium Support.
- Use the Stripe session total for revenue tracking, so annual purchases report their actual totals.
- Keep legacy prices recognized for existing subscribers while preventing old annual offers from being selected by the new UI.

## Verification
- Confirm the annual selector defaults correctly on a fresh visit and that monthly/annual values and checkout selections match.
- Check homepage, public pricing, account billing, and upgrade views at desktop and mobile widths.
- Validate that current monthly paths still select their unchanged price IDs.
- Test the updated Stripe-related functions and verify the new price records.
- Report every created Stripe price by product name, amount, interval, and price ID, followed by a complete change list.
