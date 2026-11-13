# Stape server Purchase

SaaS Suite sends one server Purchase per paid order to the Stape server GTM container. The container fans that single request out to one Facebook Conversions API tag per pixel. The browser pixel still fires its own Purchase. Both copies use the same `event_id`, so Meta keeps one conversion.

This document is the contract for the server container. The app does not call `graph.facebook.com` for a Purchase while `STAPE_SERVER_URL` is set.

## Endpoint

`POST {STAPE_SERVER_URL}{STAPE_PURCHASE_PATH}`

| Secret | Required | Default | Purpose |
| --- | --- | --- | --- |
| `STAPE_SERVER_URL` | yes, to turn the path on | unset | Origin only, for example `https://xyaheorc.usw.stape.io`. Must be `https`. Unset keeps today's direct Meta Purchase. |
| `STAPE_PURCHASE_PATH` | no | `/data` | Path on that origin. A blank, relative, or unsafe value also uses `/data`. |
| `STAPE_EVENT_NAME` | no | `Purchase` | `event_name` on every Purchase. Letters, digits, and underscores, up to 40 characters. |
| `STAPE_TEST_EVENT_CODE` | no | unset | `test_event_code` for a flagged test order when the order itself does not carry one. |

The live URL with the defaults is:

`POST https://xyaheorc.usw.stape.io/data`

`Content-Type: application/json`

One request per order. Do not add a second tag trigger that expects a second POST. Map this body onto one Facebook CAPI tag per pixel (`745177780828109` and `1601372838188959`). Send both tags the same `event_id`.

`pixel_ids` is informational. The container decides the fan-out. Ignoring `pixel_ids` is correct. Filtering the event down to one pixel would drop the other dataset.

## When a Purchase is sent

The switch is `STAPE_SERVER_URL`.

- Unset: kit Purchases stay on the existing path. That is direct Meta, or the older GA4 `/g/collect` (or `/mp/collect`) POST when `STAPE_PURCHASE_URL` is set. App and subscription Purchases stay on direct Meta. Nothing in this JSON contract runs.
- Set: kit checkout, kit upsell, kit retry, app checkout (`notify-stripe-purchase`), course checkout, and the Stripe subscription webhook POST this JSON and do not call Meta. The browser call to the `meta-capi` function also skips the Graph Purchase, so the pixel and this one server event are the only copies.

A `$0` or fully discounted order is not a Purchase. Kit orders marked tracking-opt-out or comped are not a Purchase.

Logs name the route and the order id (`purchase route stape`, `purchase route direct`, `purchase route skipped test`). They do not include email, phone, name, IP, or user agent.

## JSON body

```json
{
  "event_name": "Purchase",
  "event_id": "order_cs_live_example",
  "event_time": 1700000000,
  "action_source": "website",
  "event_source_url": "https://saassuite.ai/one-feature-kit/checkout",
  "user_data": {
    "em": ["<sha256 hex>"],
    "ph": ["<sha256 hex>"],
    "fn": ["<sha256 hex>"],
    "ln": ["<sha256 hex>"],
    "external_id": ["<sha256 hex>"],
    "fbp": "fb.1.1700000000000.1234567890",
    "fbc": "fb.1.1700000000000.IwAR2example",
    "client_ip_address": "203.0.113.10",
    "client_user_agent": "Mozilla/5.0"
  },
  "custom_data": {
    "value": 370,
    "currency": "USD",
    "content_ids": ["kit"],
    "order_id": "cs_live_example",
    "content_name": "The GoHighLevel One Feature Kit",
    "num_items": 1
  },
  "pixel_ids": ["745177780828109", "1601372838188959"],
  "x-fb-ud-em": "<sha256 hex>",
  "x-fb-ud-ph": "<sha256 hex>",
  "x-fb-ud-fn": "<sha256 hex>",
  "x-fb-ud-ln": "<sha256 hex>",
  "x-fb-ud-external_id": "<sha256 hex>",
  "x-fb-ck-fbp": "fb.1.1700000000000.1234567890",
  "x-fb-ck-fbc": "fb.1.1700000000000.IwAR2example",
  "ip_override": "203.0.113.10",
  "user_agent": "Mozilla/5.0",
  "page_location": "https://saassuite.ai/one-feature-kit/checkout",
  "value": 370,
  "currency": "USD",
  "transaction_id": "cs_live_example",
  "test_event_code": "TEST12345"
}
```

`content_name` and `num_items` are omitted when the order has no name or count. `test_event_code` is omitted on a live order. Hashed `user_data` keys are omitted when that value is missing. `fbp`, `fbc`, `client_ip_address`, and `client_user_agent` are omitted when missing. The flat keys below are also omitted when their value is empty or null. The body never sends an empty string for a missing match key.

`page_location` is the same string as `event_source_url`. `value` and `currency` match `custom_data`. `transaction_id` is `custom_data.order_id`. `event_id` is already a top-level field.

### Flat keys for the inherit-from-client Facebook CAPI tag

The container's Facebook CAPI tag, in inherit-from-client mode, reads flat event-data keys. It does not read the nested `user_data` object. Keep `user_data` on the body. Also copy the same values to these top-level keys so that tag can inherit them.

| Top-level key | Same value as | Shape |
| --- | --- | --- |
| `x-fb-ud-em` | `user_data.em[0]` | SHA-256 hex string, not an array |
| `x-fb-ud-ph` | `user_data.ph[0]` | SHA-256 hex string, not an array |
| `x-fb-ud-fn` | `user_data.fn[0]` | SHA-256 hex string, not an array |
| `x-fb-ud-ln` | `user_data.ln[0]` | SHA-256 hex string, not an array |
| `x-fb-ud-external_id` | `user_data.external_id[0]` | SHA-256 hex string, not an array |
| `x-fb-ck-fbp` | `user_data.fbp` | raw string |
| `x-fb-ck-fbc` | `user_data.fbc` | raw string |
| `ip_override` | `user_data.client_ip_address` | the buyer's captured IP |
| `user_agent` | `user_data.client_user_agent` | the buyer's captured user agent |
| `page_location` | `event_source_url` | raw string |
| `value` | `custom_data.value` | number |
| `currency` | `custom_data.currency` | uppercase ISO code |
| `transaction_id` | `custom_data.order_id` | Stripe Checkout Session id, or the upsell PaymentIntent id |
| `event_id` | `event_id` | already top-level; do not nest it |
| `test_event_code` | `test_event_code` | only when the order is a flagged test and a code is set |

`ip_override` and `user_agent` are the buyer's values captured when the checkout session was created and stored on Stripe metadata as `client_ip` and `client_ua`. The kit payment function stores them from that browser request. The webhook, refire, retry, and `notify-stripe-purchase` later copy those stored strings. They are never the edge function's own request IP or `User-Agent`. A session with no stored IP or user agent omits `ip_override` and `user_agent`. App and subscription checkout does not currently store those two fields, so those Purchases omit them until a checkout path saves the buyer's values.

### Field mapping for the Facebook CAPI tag

| JSON field | CAPI field | Notes |
| --- | --- | --- |
| `event_name` | `event_name` | Default `Purchase`. Override with `STAPE_EVENT_NAME`. |
| `event_id` | `event_id` | Must be copied unchanged. This is the dedupe key. |
| `event_time` | `event_time` | Unix seconds, not milliseconds. |
| `action_source` | `action_source` | Always `website`. |
| `event_source_url` | `event_source_url` | Page that produced the order. |
| `user_data.*` | `user_data.*` | See hashing below. |
| `custom_data.value` | `custom_data.value` | Dollars, the amount Stripe collected. |
| `custom_data.currency` | `custom_data.currency` | ISO code, uppercase. |
| `custom_data.content_ids` | `custom_data.content_ids` | Kit line ids, or the app plan / course id. |
| `custom_data.order_id` | `custom_data.order_id` | Stripe Checkout Session id, or the upsell PaymentIntent id. |
| `pixel_ids` | do not use as a filter | Both pixels, informational. |
| `test_event_code` | `test_event_code` | Top level of the CAPI payload, not inside `user_data`. Only on test orders. |

## Hashing

SHA-256 is lowercase hex. Inside `user_data`, hashed values are a one-element array, matching Meta's Conversions API. The flat `x-fb-ud-*` keys are that same hex as a string, not an array. Normalization is identical for both.

| Key | Normalization before SHA-256 | Sent raw |
| --- | --- | --- |
| `em` | trim, lowercase | no |
| `ph` | digits only; a 10-digit US number is prefixed with `1` | no |
| `fn` | trim, lowercase. A single full name is split on whitespace into first and last. | no |
| `ln` | trim, lowercase | no |
| `external_id` | trim, lowercase. Stripe customer id when we have one. | no |
| `fbp` | unchanged `_fbp` cookie | yes |
| `fbc` | unchanged `_fbc` cookie. If only `fbclid` was stored, the server builds `fb.1.<event_time ms>.<fbclid>`. | yes |
| `client_ip_address` | unchanged | yes |
| `client_user_agent` | unchanged | yes |

Do not hash `fbp`, `fbc`, the IP, or the user agent again in the tag. Do not lowercase or re-hash the hex strings.

## Dedupe

Meta dedupes a browser Purchase and a server Purchase when `event_name` and `event_id` match. The browser pixel option is `eventID`. The server field is `event_id`. They are the same string.

| Purchase | Browser `eventID` | Server `event_id` |
| --- | --- | --- |
| One Feature Kit checkout | `order_<checkout session id>` | `order_<checkout session id>` |
| App, subscription, special offer, and course checkout | `order_<checkout session id>` when the Stripe session id is in the page | `order_<checkout session id>` |
| One Feature Kit upsell (Launch, Webinar, and the other one-click add-ons) | `order_<payment intent id>` | `order_<payment intent id>` |

The upsell id is not the checkout session id. It is a second charge. The browser pixel fires Purchase with `eventID` exactly `order_<payment intent id>`, and the server sends that same string as `event_id`, so the upsell dedupes. Do not rewrite it to the checkout session id or Meta will count the upsell twice.

Verified in the kit pixel: `trackKitUpsellPurchase` sets `eventId` to `kitPurchaseEventId(paymentIntentId)`, which is `order_` plus the PaymentIntent id (`pi_…`). `pixel()` then calls `fbq('track', 'Purchase', data, { eventID: eventId })`. Both upsell call sites (the thank-you add button and the step CTA) pass `charge.paymentIntentId`. The server upsell uses `kitUpsellMetaPurchase`, which calls the same `kitPurchaseEventId(paymentIntentId)`. The pixel event is skipped when there is no `pi_` id, the order is comped, or the amount is zero, which is the same gate as the server.

These browser fallbacks do not match the server id. They only run when the page never received a Stripe session id. The server still sends `order_<checkout session id>` from the webhook:

- Embedded app checkout, no session id: `order_<sanitized email>` or `order_nosession_<time>_<random>`.
- `/app?confirmed=true` without `session_id`: `order_<sanitized email>` or `order_confirmed_<time>_<random>`.
- Course checkout, no session id: `order_course_<time>_<random>`.

## Test orders

A test order is one of:

- `is_test` stored from `?ss_test=1` (also `?ofk_test=1`) on the Stripe metadata, the request body, or the `ss_test` cookie.
- `utm_source=qa_test` while `STAPE_SERVER_URL` is set. That utm does not change the direct Meta path.

`test_event_code` is chosen per order:

1. The order's own `test_event_code` metadata, when present.
2. Otherwise `STAPE_TEST_EVENT_CODE`.

The code changes whenever the secret or the order metadata changes. It is not baked into the app.

A flagged order with no code is not posted to Stape and is not posted to Meta. It cannot count as a live purchase. A live order never receives `test_event_code`, even if the secret is set.

In Events Manager, use the Test Events tab and the code from that session. A Purchase that carries `test_event_code` stays out of the live campaign totals.

## Idempotency

Kit checkout and upsell already claim `meta:<order id>` on `one_feature_kit_actions` before the POST. A Stripe retry, the kit refire, and `retry-kit-meta-purchases` see a completed claim and do not post again. A failed POST releases the lease so a later attempt can send. `skip_meta: true` on the refire still skips the Purchase.

App, subscription, and course checkouts claim `purchase:<checkout session id>` on the same table, with the same lease function. `notify-stripe-purchase` and `stripe-subscription-webhook` can both run for one session; the claim allows one POST. That key does not start with `meta:`, so the kit retry job does not load it. No new table is required.

## Lead, and a second Purchase tag

Training and HighLevelers opt-ins send one Lead. The browser pixel and the server Conversions API both use `event_id` `lead_<row id>` (`one_feature_training_leads.id` or `funnel_apply_leads.id`). Meta counts that pair once. A re-submit of the same email, a plan pick, the quiz, the success page, and checkout do not send another Lead.

Purchase already uses one id per charge: `order_<checkout session id>` or `order_<payment intent id>` for a kit upsell. The browser pixel and the server post share that id. Do not add another Purchase for the same charge.

`GTM-M7B83SRK` and the Stape server container are not in this repo. On Nov 3, 2026 each real training opt-in produced two pixel Leads, which matches a second Lead that did not carry this `event_id`.

In the GTM container and the Stape server container:

1. Disable any Facebook Lead tag, and any Facebook Purchase tag, that fires in addition to the site pixel and the single Stape `POST /data` Purchase. One Lead path and one Purchase path.
2. If a tag has to stay, copy `event_id` unchanged (`lead_<row id>` or `order_<charge id>`) onto that tag and do not generate a new one. Browser `eventID` and server `event_id` must be the same string.
3. Add an exception trigger so tags do not fire when the data layer variable `ss_test` is true. The site already pushes `{ ss_test: true, traffic_type: "internal" }` for `?ss_test=1`. The pixel script itself does not load on those visits. GTM still loads, so the container has to block itself.

The page drops a browser `fbq` Lead or Purchase that arrives with no `eventID`. That stops a GTM Facebook tag from adding a second browser event. It does not stop a server-container event. Step 1 above is still required for Stape.

## Container setup

1. Add a Data Client (or a custom client that accepts JSON) on `POST /data`.
2. Map the nested fields, or let the Facebook CAPI tag inherit the flat `x-fb-ud-*`, `x-fb-ck-*`, `ip_override`, `user_agent`, `page_location`, `value`, `currency`, `transaction_id`, and `event_id` keys. The flat hashes are strings. Do not wrap them in arrays in the tag.
3. Duplicate that tag for the second pixel, or set the tag's pixel list to both ids. Both tags must send the same `event_id`.
4. Put `test_event_code` on the CAPI payload only when the incoming field is present.
5. Leave the site's browser pixel Purchase in place. Do not suppress that pixel in GTM. The server event is the matching copy, not a replacement. A separate GTM or Stape Facebook Purchase tag is a duplicate and should be off (see above).

## Production test

Do this only after Andrew sets the secrets. Do not point tests or scripts at the live host.

1. Set `STAPE_SERVER_URL` to `https://xyaheorc.usw.stape.io`. Leave `STAPE_PURCHASE_PATH` unset unless the client does not listen on `/data`.
2. Set `STAPE_TEST_EVENT_CODE` to the code shown in Events Manager, Test Events, for the pixel you are watching. Generate a fresh code for the session.
3. Open the kit or app checkout with `?ss_test=1`.
4. Pay with a Stripe test card (or the smallest live offer only if finance has approved a live charge; the `ss_test` flag still marks it as a test order).
5. Confirm one `POST /data` in the Stape logs, with `event_name` `Purchase`, `event_id` `order_<session id>`, and `test_event_code` equal to the secret.
6. Confirm the browser pixel fired a Purchase with the same `eventID`.
7. In Events Manager Test Events, confirm one deduped Purchase on each pixel, not two. The overview and ads manager should not gain a live Purchase for this order.
8. Reload the thank-you page and let Stripe redeliver the webhook. Stape should not receive a second POST for that `order_id`.
9. Remove `STAPE_TEST_EVENT_CODE` only after the test. A later `?ss_test=1` purchase is then dropped instead of counted.
