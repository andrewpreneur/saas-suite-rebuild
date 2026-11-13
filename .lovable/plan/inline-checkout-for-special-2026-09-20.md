# Inline checkout for `/special`

## Goal
Move the $2,470 SuperSaaSSuite Annual checkout out of its popup and into a dedicated purchase section near the bottom of the page. Keep the monthly-plan checkouts unchanged.

## Changes
- Add an inline display mode to the existing Stripe checkout so it can render safely inside the page without popup controls.
- Add a bottom purchase section with:
  - Offer name, $2,470 annual price, included bonuses, and secure-payment reassurance on the left.
  - The live Stripe checkout on the right.
- On mobile, stack the offer summary first and checkout second so buyers naturally scroll from details into payment.
- Make every annual-offer button smoothly scroll to and initialize this section instead of opening a popup.
- Preserve the existing purchase completion, tracking, attribution, and post-payment redirect behavior.

## Validation
- Check desktop and 375px mobile layouts.
- Confirm annual buttons scroll to the inline checkout, while Basic, Advanced, and Premium Support still use their current popup checkouts.
- Confirm loading, error/retry, keyboard focus, and reduced-motion behavior remain usable.
