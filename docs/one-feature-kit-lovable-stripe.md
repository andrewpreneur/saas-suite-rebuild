# One Feature Kit payments — paste this into Lovable

Copy the prompt below into Lovable's chat as one message. It is the only instruction. Do not shorten it.

```
Make the GoHighLevel One Feature Kit funnel take real one-time card payments. Work only in the kit payment path. Do not change funnel copy, scarcity, routing, the thank-you form, or any subscription billing.

How the code works today
- src/funnel/one-feature-kit/order.ts exports ONE_FEATURE_KIT_PAYMENTS_LIVE = false. While that is false, checkout does not charge. #ofk-complete calls completeCheckout(), stores a stub checkout id like stub_xxxxxxxx in sessionStorage key ofk-one-feature-kit-v2, and navigates to /one-feature-kit/ghl-signup-and-upgrade.
- paymentsLiveBlock() returns null while the flag is false. If the flag is true and any stripePriceId is empty, completeCheckout() and an accepted decide() throw. So fill every price id before you flip the flag. If you flip it early, the funnel breaks.
- src/funnel/one-feature-kit/stripe.ts is the catalog. Each row has id, name, amountCents, type "one_time", stripePriceId (all empty), and chargedOn. missingKitPriceIds() lists rows whose stripePriceId is empty. KIT_SLACK_AGENCY_ID is "".
- Bumps default to all ticked. checkoutLines() always includes the kit, then bump-replay, bump-video, and bump-install only when that bump is ticked. Default total is 37000 cents ($370.00). Kit alone is 2700 cents ($27.00).
- Launch Pack and Webinar are not in the checkout session. wire.ts calls decide() when the buyer clicks Yes or No thanks on those pages (PAGE_OFFER). Yes adds the offer line. No does not. /one-feature-kit/ghl-signup-and-upgrade never charges.
- After a checkout id exists, the thank-you page calls maybeNotifyKitPurchase() once. planKitSlackPing() sends only when the flag is true, checkoutId is set, and KIT_SLACK_AGENCY_ID is non-empty. It POSTs to ${VITE_SUPABASE_URL}/functions/v1/one-feature-kit-purchase-notify with { agency_id, event_type: "one_feature_kit_purchase", data: { checkout_id, name, email, phone, total, lines } }.
- supabase/functions/one-feature-kit-purchase-notify already forwards that body to slack-notify. It uses body.agency_id, or the KIT_SLACK_AGENCY_ID secret if the body id is empty. If SLACK_NOTIFY_TOKEN is missing it skips. slack-notify posts to the Slack install stored for that agency_id. A 404 (no install or no channel) is treated as a skip. Do not rewrite slack-notify. one_feature_kit_purchase already renders through slack-notify's default event block.

Create these live-mode one-time USD products and prices. Use the existing live Stripe account (STRIPE_SECRET_KEY), not the test key. Amounts must match the cents below. Do not create subscriptions.

| id | name | amountCents | charged when |
| kit | The GoHighLevel One Feature Kit | 2700 | every checkout session |
| bump-replay | Full 90-Minute Training Replay | 1700 | checkout, only if ticked |
| bump-video | Done-For-You Branded AI Studio Sales Video | 2700 | checkout, only if ticked |
| bump-install | DFY Installation, Customization, and Setup | 29900 | checkout, only if ticked |
| launch | 25 white-labeled ad templates | 14700 | Yes on /one-feature-kit/launch-pack |
| webinar-system | Webinar Sales System | 9700 | Yes on /one-feature-kit/webinar-sales-system |

Paste each live Price ID (price_...) into the matching stripePriceId in src/funnel/one-feature-kit/stripe.ts. Leave the ids, names, and amountCents as they are.

Checkout session
- Add a new edge function for this funnel. Do not call or edit supabase/functions/create-checkout. That function charges SaaSSuite subscription prices (basic, advanced, special, premium support) and must stay untouched.
- When ONE_FEATURE_KIT_PAYMENTS_LIVE is still false, keep today's stub: no Stripe call, stub checkout id, continue to the GoHighLevel step.
- When the flag is true, #ofk-complete must not invent a stub id and must not navigate until Stripe has been paid. Create a Checkout Session in mode payment with only the kit price plus the price ids of the ticked bumps. Unticked bumps are omitted.
- Save the card for later one-click charges: payment_intent_data.setup_future_usage = "off_session" (or the current Stripe equivalent). Put the buyer's name, email, and phone in customer details and metadata, plus the line ids that were charged.
- Success URL: https://saassuite.ai/one-feature-kit/ghl-signup-and-upgrade?session_id={CHECKOUT_SESSION_ID}
- Cancel URL: https://saassuite.ai/one-feature-kit/checkout
- On return, the server retrieves that session and continues only if payment_status is paid. Then save the Stripe session id as checkoutId (not a stub_ id), the customer id, and the payment method id with the draft. If the session is not paid, stay on checkout and show a normal error. Do not trust the query string alone.

One-click upsells
- Yes on Launch Pack charges only the launch price. Yes on Webinar Sales System charges only the webinar-system price. No thanks on either page charges nothing and still continues.
- Charge the card saved by the checkout session: a PaymentIntent on that customer and payment method, off_session, confirmed, for that one price. Idempotency key so a double click cannot charge twice.
- Only after the PaymentIntent succeeds, record the offer the way decide(draft, offerId, "accepted") does and navigate forward. If the charge fails, stay on the page, do not add the line, and show a short customer error. Do not send them to thank-you as if they bought it.
- The GoHighLevel step stays free. Do not attach a price to it.

Flag
- Set ONE_FEATURE_KIT_PAYMENTS_LIVE to true only after all six price ids are filled, a live test of kit-only ($27), all three bumps ($370), each single bump combination, Launch Pack Yes ($147), Webinar Yes ($97), and both No buttons has succeeded, and a declined card does not create a checkout id.

Slack
- Ask Andrew for the agency id whose Slack install should receive kit purchases. Do not invent one. Put that exact id in KIT_SLACK_AGENCY_ID in stripe.ts and in the KIT_SLACK_AGENCY_ID edge secret. If it stays empty, planKitSlackPing() will not call the notify function.
- Confirm the secret SLACK_NOTIFY_TOKEN is set. The notify function skips the ping when it is missing.
- A paid checkout must call one-feature-kit-purchase-notify once with event_type "one_feature_kit_purchase" and data.checkout_id, name, email, phone, total (formatUsd of the charged cents), and lines (the charged labels). Do this from the server when the Checkout Session is confirmed paid, so a closed tab still pings. Keep the thank-you page's maybeNotifyKitPurchase() call, but make the ping idempotent on checkout_id so the success return and the thank-you page do not post twice.
- After a successful upsell PaymentIntent, send one more ping for that add-on (same event type, that line and its amount, same checkout_id plus the offer id). A No click must not ping.
- Do not call slack-notify from the browser. Do not call one-feature-lead.

Secrets the new functions need
- STRIPE_SECRET_KEY (already used by subscription checkout; reuse it, do not replace it)
- STRIPE_WEBHOOK_SECRET for a new kit webhook endpoint
- SLACK_NOTIFY_TOKEN (must already be set, or the ping is skipped)
- KIT_SLACK_AGENCY_ID (Andrew's agency id)
- SUPABASE_URL is already provided to edge functions

Webhook
- Add a kit-only webhook endpoint. Register it in the live Stripe dashboard for checkout.session.completed and payment_intent.succeeded.
- On checkout.session.completed, ignore anything that is not this funnel (check metadata). Confirm the amount matches the sum of the kit plus the bumps in metadata. Then fire the idempotent Slack ping.
- On payment_intent.succeeded, handle only the upsell intents this funnel created. Then fire that upsell's ping.
- Do not edit stripe-subscription-webhook or any handler that provisions SaaSSuite subscriptions.

Do not touch
- supabase/functions/create-checkout
- subscription prices, trials, or plan ids
- slack-notify's event switch, except you may leave one_feature_kit_purchase on the default formatter
- public.funnel_onboarding and the thank-you insert
- scarcity, sales copy, bump layout, and redirects
- ONE_FEATURE_KIT_REVIEW_CHROME (leave it false)
```
