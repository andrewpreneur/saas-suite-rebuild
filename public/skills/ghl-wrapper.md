---
name: ghl-wrapper
description: Connect any frontend/app to GoHighLevel (HighLevel / LeadConnector) API v2. Use whenever wiring a web or mobile app to GHL — authenticating with a Private Integration Token, storing/encrypting credentials, calling the API (contacts, calendars & appointments, conversations/messaging, opportunities, payments/invoices/orders/subscriptions/coupons, products, media, users, locations, custom fields, workflows, forms), handling webhooks, per-location multi-tenant setups, pagination, rate limits, and the many GHL quirks (Version headers, altId/altType, E.164 phones, Unix-ms times). Battle-tested patterns distilled from a production EMR integration.
---

# GHL Wrapper — GoHighLevel API v2 integration guide

Everything needed to connect a "vibe-coded" frontend to **GoHighLevel** (a.k.a. HighLevel / GHL / LeadConnector). This skill is the distilled, **field-tested** playbook: the auth model, a drop-in client, every endpoint group, and the quirks that cost hours to discover.

> Marketplace docs: https://marketplace.gohighlevel.com/docs/ · API base: `https://services.leadconnectorhq.com`

## How to use this skill

1. **Read this file top-to-bottom once** — it contains the golden rules that prevent 90% of failures.
2. Copy `reference/client.ts` into the target app as the single GHL access layer. Never call GHL from more than one place.
3. Open `reference/endpoints.md` for the full endpoint catalog (paths, methods, Version, params, response shape) — load it when you need an endpoint not already on the client.
4. Open `reference/gotchas.md` when something 4xx's — it's an index of every known quirk keyed by symptom.
5. `reference/connection.md` has the end-to-end connection + credential-storage + multi-tenant setup.

Mark endpoints you personally verify against a live account as ✅ in `endpoints.md` — the catalog distinguishes **battle-tested** from **documented-but-unverified**.

## The 12 golden rules (memorize these)

1. **Server-side only.** The token is a full-access credential. NEVER ship it to the browser, a mobile bundle, or any client. All GHL calls go through your backend (an API route / serverless function). The frontend calls *your* endpoints; your backend calls GHL.
2. **Base URL is `https://services.leadconnectorhq.com`** — NOT `rest.gohighlevel.com` (that's the deprecated v1 API). This skill is v2 only.
3. **Auth header:** `Authorization: Bearer <token>`. For a single-account app, use a **Private Integration Token (PIT)**. For a multi-account SaaS, use OAuth 2.0 (see `connection.md`).
4. **`Version` header is REQUIRED on every call.** Default `2021-07-28`. But a whole family of endpoints needs **`2021-04-15`**: payments (orders, transactions, subscriptions, coupons), invoices in some accounts, notes, and media rename/delete. Wrong version → 401/404/422 that *looks* like an auth problem but isn't. See the per-endpoint Version column in `endpoints.md`.
5. **`locationId` scopes almost everything.** Most reads take it as a query param or in the body; most writes take it in the body. A call that returns an empty list or 422 is often a missing/blank `locationId`.
6. **Payments/invoices/media use `altId` + `altType`, not `locationId`.** Pass `altId: <locationId>`, `altType: 'location'`. And for invoices, **`offset` must be a STRING** (`offset: "0"`) — a number 422s with "offset must be a string".
7. **Phone numbers must be E.164** (`+15551234567`). Normalize before sending or the contact write is rejected. `upsertContact` needs **at least one of email or phone** — strip empties.
8. **Calendar event times are Unix milliseconds, not ISO.** `GET /calendars/events` and free-slots take `startTime`/`endTime` (or `startDate`/`endDate`) as **epoch ms**. But `POST /calendars/events/appointments` takes **ISO 8601 with a timezone offset**.
9. **`GET /calendars/events` requires one of `calendarId` / `userId` / `groupId`.** The unfiltered "all events" call 422s. To get every appointment, list calendars then fan out per-calendar and merge by event id.
10. **Store the calendar-local wall-clock, not UTC.** GHL returns appointment `startTime` as offset-form ISO (`...T10:00:00-07:00`). If you `new Date(x).toISOString()` it, a 10am appt becomes 5pm in UTC. Split the string or keep the offset. (See gotchas → "10am shows as 5pm".)
11. **Pagination is cursor-based on most list endpoints** (`meta.startAfter` / `meta.startAfterId`), page-based on a few. Never assume one page = all. And **never run destructive "delete what GHL didn't return" logic off a partial/failed fetch** — only prune when you *know* you reached the end (reported total reached, or a short final page).
12. **Rate limits: ~100 req / 10s burst and ~200k/day per resource (Marketplace app).** Handle `429` with backoff. Fan-out calls (per-calendar, per-contact) should be concurrency-capped, not unbounded `Promise.all` over thousands.

## Connection process (single-account PIT — the common case)

1. In the GHL sub-account: **Settings → Private Integrations → Create** a token with the scopes you need (contacts, calendars, conversations, payments, medias, etc.).
2. Grab the **Location ID** (Settings → Business Info, or the URL). PIT + Location ID = a working connection.
3. **Validate on connect** by calling a cheap authenticated endpoint — `GET /locations/{locationId}` or `GET /users/profile`. A 200 confirms token+location; anything else → surface "verify token & Location ID".
4. **Encrypt the token at rest** (AES-256-GCM) and store it with the location id. Never log it. See `connection.md` for the exact encryption helper and the per-location storage table.
5. All later calls resolve the token+locationId for the active account and construct the client.

For a **multi-tenant** app (many GHL accounts / one per customer or location): store one encrypted credential row **per location**, keyed by your internal tenant/location id, and resolve the right one per request. `connection.md` has the full pattern (this is exactly how the source EMR handles multiple clinics).

## Wiring it into a vibe-coded frontend

The shape that works every time:

```
Browser / app  ──HTTP──▶  YOUR backend route  ──GHLClient──▶  GHL API
   (no token)              (holds the token)      (Bearer)
```

- **One access layer:** `reference/client.ts` → a `GHLClient` class. Construct it per request from the stored credential; don't instantiate it in the browser.
- **Thin proxy routes:** each frontend need → one backend route that calls a client method, checks auth/permissions, and returns JSON. Example (Next.js App Router):
  ```ts
  // app/api/contacts/route.ts  (server)
  export async function POST(req: Request) {
    const body = await req.json()
    const ghl = await getGHLClient()            // resolves token+locationId server-side
    const contact = await ghl.upsertContact(body)
    return Response.json({ contact })
  }
  ```
- **Never** put the token in `NEXT_PUBLIC_*`, a client component, localStorage, or a mobile app bundle.
- **Surface GHL's real error message** to the frontend, mapped to a sane status: availability/business-rule rejections are 409/422 (client fixable), auth/config problems are 401/500. Don't turn every GHL error into a 500.
- **Tags trigger workflows.** Adding a tag to a contact (`POST /contacts/{id}/tags`) is the canonical way to fire a GHL automation (e.g. "send consent form"). Design around tag-driven workflows rather than trying to script everything via API.

## What the client already covers (from the reference file)

`reference/client.ts` ships verified methods for: contacts (get/search/getAll-paginated/upsert/update/tags/notes), calendars & appointments (list calendars, list events, get/create/update appointment, free-slots), conversations (send SMS/email, get messages), invoices, orders, transactions, subscriptions, coupons (CRUD), media (folders/upload/rename/delete), users, locations, and a connection-test. Extend it using `endpoints.md` for anything else.

## When stuck

- 401 → wrong/expired token, OR missing/wrong `Version` header (try `2021-04-15` for payments/notes/media), OR calling v1 base URL.
- 422 → missing `locationId`/`altId`, numeric `offset` where a string is required, bad phone format, or the unfiltered `/calendars/events` call.
- Empty list but you expect data → wrong `locationId`/`altId`, wrong Version, or the resource genuinely lives under a different endpoint (Skin Bar sold via **orders**, not invoices — check all of orders/invoices/transactions).
- Times off by hours → the UTC-conversion trap (rule 10).
- Full symptom→cause index: `reference/gotchas.md`.


---

# Appendix A — connection.md

# Connection, credential storage & multi-tenant setup

## Two ways to authenticate

### A) Private Integration Token (PIT) — single account / simplest
Best for an app that serves **one** GHL sub-account (or a fixed set you configure by hand).

1. GHL sub-account → **Settings → Private Integrations → Create new integration**.
2. Select scopes (contacts.readonly/write, calendars.*, conversations/message.write, payments/*, medias.*, etc. — grant only what you use).
3. Copy the token (starts with `pit-...`). Copy the **Location ID** (Settings → Business Info, or from the app URL `/location/<id>/`).
4. That's it — `Authorization: Bearer <pit>` + `locationId`. PITs don't expire and need no refresh.

### B) OAuth 2.0 — multi-account SaaS (Marketplace app)
Use when customers connect *their own* GHL accounts.

1. Create a Marketplace app, set redirect URL + scopes.
2. Redirect the user to `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&client_id=...&redirect_uri=...&scope=...`.
3. Exchange the `code` at `POST https://services.leadconnectorhq.com/oauth/token` (`grant_type=authorization_code`) → get `access_token` (~24h) + `refresh_token`.
4. **Refresh before expiry** with `grant_type=refresh_token`. Store both tokens (encrypted) per location, plus `expires_at`.
5. `access_token` is used exactly like a PIT (`Bearer`) — the client in `client.ts` works unchanged; you just refresh + swap the token.

> Everything else in this skill (Version headers, altId/altType, endpoints, quirks) is identical for PIT and OAuth.

## Validate on connect (don't trust unverified creds)

Before saving, prove the credential works with a cheap authenticated call:

```ts
const client = new GHLClient({ token, locationId })
try { await client.getLocation() }            // GET /locations/{id} — 200 = valid
catch { throw new Error('Invalid token or Location ID. Verify both in your CRM → Private Integrations.') }
```

`GET /users/profile` also works as a probe.

## Encrypt the token at rest (AES-256-GCM)

Never store the token in plaintext, never log it, never return it to the client. Format below is `iv:authTag:ciphertext` (hex). Key from a 64-hex-char `ENCRYPTION_KEY` env var (32 bytes), with a scrypt dev fallback.

```ts
import crypto from 'crypto'
const ALGO = 'aes-256-gcm', KEY_LEN = 32
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || ''
  if (hex.length < KEY_LEN * 2) return crypto.scryptSync(hex || 'dev-key', 'salt', KEY_LEN) // dev only
  return Buffer.from(hex.slice(0, KEY_LEN * 2), 'hex')
}
export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(16), c = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = c.update(plain, 'utf8', 'hex') + c.final('hex')
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc}`
}
export function decryptToken(ct: string): string {
  const [ivHex, tagHex, enc] = ct.split(':')
  if (!ivHex || !tagHex || !enc) throw new Error('Invalid ciphertext format')
  const d = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  d.setAuthTag(Buffer.from(tagHex, 'hex'))
  return d.update(enc, 'hex', 'utf8') + d.final('utf8')
}
```

Generate a key once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Storage schema (one row per connected location = multi-tenant ready)

```sql
CREATE TABLE integrations_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID,                         -- your internal location/clinic/customer id
  integration_name TEXT NOT NULL,              -- 'GoHighLevel'
  api_key        TEXT NOT NULL,                -- ENCRYPTED token (iv:tag:ct)
  status         TEXT DEFAULT 'connected',     -- 'connected' | 'disconnected'
  config_data    JSONB,                        -- { "locationId": "...", "environment": "production", refresh/expiry for OAuth }
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_name, tenant_id)
);
```

Store the **locationId inside `config_data`**, not as the tenant id — your tenant id is your own, the GHL locationId is theirs. This lets one app hold many GHL accounts, each isolated.

## The client factory (resolve the right credential per request)

```ts
export async function getGHLClient(tenantId?: string): Promise<GHLClient> {
  const cid = tenantId ?? await getActiveTenantId()   // however you resolve "current account"
  const { rows } = await query(
    `SELECT api_key, config_data FROM integrations_config
      WHERE integration_name='GoHighLevel' AND status='connected' AND tenant_id=$1 LIMIT 1`, [cid])
  if (!rows[0]) throw new Error('CRM not connected for this account.')
  const token = decryptToken(rows[0].api_key)
  const locationId = rows[0].config_data?.locationId
  if (!token || !locationId) throw new Error('CRM credentials incomplete. Reconnect.')
  return new GHLClient({ token, locationId })
}
```

Multi-tenant rule: **every** query that reads GHL-derived data must be scoped by `tenant_id`, and `getGHLClient(tenantId)` must resolve the SAME tenant you're writing under — a mismatch silently leaks/loses data across accounts.

## Webhooks (GHL → your app)

- Configure webhooks in the Marketplace app (or per-workflow "Webhook" action). GHL POSTs JSON to your public URL.
- Your webhook route must be **public** (no auth cookie) — exclude it from your auth middleware.
- Verify authenticity: Marketplace webhooks are signed — verify the signature header with GHL's public key; for workflow webhooks, use a shared secret in the URL/path.
- Common events: contact create/update/delete, appointment create/update, inbound message, order/payment. Use these to keep your cache in sync instead of polling.
- Respond `200` fast; do heavy work async. A non-2xx makes GHL retry.

## Disconnect / reconnect

- Disconnect = set `status='disconnected'` (keep the row for history) or delete it. Don't leave a dead token marked connected.
- Reconnect = re-validate + re-encrypt + upsert. Bump `updated_at`.


---

# Appendix B — gotchas.md

# GHL gotchas — symptom → cause → fix

Every one of these cost real debugging time on a production integration. Scan by symptom.

## Auth / headers

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on a call that *should* work | Missing or wrong **`Version`** header | Add `Version: 2021-07-28`; for payments/subscriptions/coupons/orders/transactions/notes/media-rename+delete use **`2021-04-15`** |
| Everything 401s | Using v1 base URL `rest.gohighlevel.com`, or token not `Bearer`-prefixed | Base URL must be `https://services.leadconnectorhq.com`; header `Authorization: Bearer <token>` |
| Worked yesterday, 401 today (OAuth) | Access token expired (~24h) | Refresh with `grant_type=refresh_token`; store `expires_at` and refresh proactively |
| 403 on a valid token | Missing **scope** on the PIT / OAuth app | Re-issue the token with the needed scope |

## locationId / altId / altType

| Symptom | Cause | Fix |
|---|---|---|
| List endpoint returns `[]` but data exists | Missing/blank `locationId` (or wrong location) | Pass `locationId` (query for GETs, body for writes) |
| Payments/invoices/media 422 "altId should not be empty" / "altType must be a valid enum" | Those endpoints use **`altId` + `altType`**, not `locationId` | `altId: <locationId>, altType: 'location'` |
| Invoices `422 offset must be a string` | `offset` sent as a number | Send `offset: "0"` (string) — invoices only |
| Data missing though it exists in GHL | Resource lives under a different endpoint | Money can be under **orders**, **invoices**, or **transactions** — check all three; a location may sell via orders, not invoices |

## Contacts

| Symptom | Cause | Fix |
|---|---|---|
| Contact write 422 on phone | Phone not E.164 | Normalize to `+15551234567` before sending (see `normalizePhone`) |
| `upsertContact` 422 | Neither email nor phone provided, or empty string sent | Require ≥1 of email/phone; delete empty keys |
| Duplicate contacts created | Used create instead of upsert | Use `/contacts/upsert` (dedupes by email/phone) |
| Sync deletes contacts that reappear next sync | Pruned off a **partial** fetch | Only archive when the full fetch is `complete` (reported total reached / short final page); verify each candidate is truly gone (404 on `GET /contacts/{id}`) before deleting |
| Tag added but workflow didn't fire | Tag string mismatch (case/spacing) or workflow not tag-triggered | Match the exact tag the workflow listens for; tags are the intended automation trigger |

## Calendars & appointments

| Symptom | Cause | Fix |
|---|---|---|
| `GET /calendars/events` 422 | Called without `calendarId`/`userId`/`groupId` | Provide one; to get all, list calendars and fan out per-calendar, merge by event id |
| Events query returns nothing | Passed ISO strings for time | `startTime`/`endTime` must be **Unix milliseconds** for events & free-slots |
| **10am appointment shows as 5pm** (or a fixed hour offset) | `new Date(offsetISO).toISOString()` collapsed the tz offset to UTC | Store the calendar-LOCAL wall clock — split the offset-form ISO (`...T10:00:00-07:00` → date `...`, time `10:00:00`) or keep the offset; NEVER round-trip through UTC |
| Booked appointment "disappears" from the calendar | UI only loaded the current month, or filtered by a mismatched location scope | Load a wide date window (e.g. −1 → +12 months); ensure the appointment's stored location scope matches the view's |
| `POST appointment` "slot no longer available" on reassign/reschedule | Free-slot validation | Pass `ignoreFreeSlotValidation: true` (and/or `ignoreDateRange: true`) on the update |
| free-slots returns empty for a wide range | Range > ~31 days | Cap the free-slots window at 31 days |
| `POST appointment` wants ISO but events want ms | They genuinely differ | Create/update appointment = **ISO 8601 w/ offset**; events list & free-slots = **Unix ms** |

## Payments

| Symptom | Cause | Fix |
|---|---|---|
| All payments endpoints 404/401 | Wrong Version | Use `Version: 2021-04-15` for orders/transactions/subscriptions/coupons |
| Coupons/orders empty | `altId/altType` missing, or account uses a different sales object | Pass altId/altType; check orders vs invoices vs transactions |
| Totals wrong | Mixing invoice status with order payment_status | Compute paid/pending/overdue from the object that actually represents money in that account |

## Pagination & rate limits

| Symptom | Cause | Fix |
|---|---|---|
| Only ~100 records come back | One page only | Follow `meta.startAfter`/`meta.startAfterId` (cursor) or `page` until a short/empty page |
| `429 Too Many Requests` | Burst limit (~100/10s) | Backoff + retry; concurrency-cap fan-out (don't `Promise.all` thousands) |
| Huge fan-out hangs / partial | Unbounded parallelism | Cap concurrency (e.g. 5–10), use `Promise.allSettled` so one bad calendar/contact doesn't kill the batch |

## Response shape

| Symptom | Cause | Fix |
|---|---|---|
| `data.contact` undefined | Response shape varies (`{contact}` vs bare object; `{data}` vs `{orders}`) | Read defensively: `data.contact || data`, `data.data || data.orders || []` |
| Provider shows as a long alphanumeric id | That's `assignedUserId`, not a name | Resolve via `GET /users/` and map id → name |


---

# Appendix C — endpoints.md

# GHL API v2 endpoint catalog

Base: `https://services.leadconnectorhq.com` · Header `Authorization: Bearer <token>` on all.
**Version** column: header value required for that group. **✅** = verified against a live account in the source EMR integration. Others are documented endpoints — confirm the exact request/response schema against the live docs (https://marketplace.gohighlevel.com/docs/) before relying on them, and flip to ✅ once you have.

Legend: `{id}` path params · `?param` query · body params in prose. Most write bodies need `locationId`; payments/invoices/media need `altId`+`altType` instead.

---

## Contacts  (Version 2021-07-28)

| ✅ | Method | Path | Key params | Notes |
|---|---|---|---|---|
| ✅ | GET | `/contacts/{id}` | — | Returns `{contact}` |
| ✅ | GET | `/contacts/` | `?locationId&limit&startAfter&startAfterId&page` | Paginated; cursor via `meta.startAfter(Id)` |
| ✅ | POST | `/contacts/search` | body `locationId,query,email,phone,limit,page` | Advanced search |
| ✅ | POST | `/contacts/upsert` | body `locationId,firstName,lastName,email,phone,tags,source,customFields` | Dedupes by email/phone; phone E.164; ≥1 of email/phone |
| ✅ | PUT | `/contacts/{id}` | body fields to update | |
|  | POST | `/contacts/` | body `locationId,...` | Create (prefer upsert) |
|  | DELETE | `/contacts/{id}` | — | |
| ✅ | POST | `/contacts/{id}/tags` | body `{tags:[]}` | Adds tags → triggers tag workflows |
|  | DELETE | `/contacts/{id}/tags` | body `{tags:[]}` | Remove tags |
| ✅ | POST | `/contacts/{id}/notes` | body `{body,userId?}` · **Version 2021-04-15** | |
|  | GET/PUT/DELETE | `/contacts/{id}/notes[/{noteId}]` | | List/update/delete notes |
|  | GET/POST | `/contacts/{id}/tasks[/{taskId}]` | | Tasks (also PUT/DELETE) |
|  | POST/DELETE | `/contacts/{id}/campaigns/{campaignId}` | | Add/remove from campaign |
|  | POST/DELETE | `/contacts/{id}/workflow/{workflowId}` | | Add/remove from workflow |
|  | GET | `/contacts/{id}/appointments` | | Contact's appointments |
|  | POST/DELETE | `/contacts/{id}/followers` | | |
|  | GET | `/contacts/business/{businessId}` | | Contacts by business |

## Conversations & Messaging  (2021-07-28)

| ✅ | Method | Path | Key params | Notes |
|---|---|---|---|---|
| ✅ | POST | `/conversations/messages` | body `type('SMS'|'Email'),contactId,message,subject,html,locationId` | Send a message |
| ✅ | GET | `/conversations/{id}/messages` | — | Thread messages |
|  | POST | `/conversations/` | body `locationId,contactId` | Create conversation |
|  | GET/PUT/DELETE | `/conversations/{id}` | | |
|  | GET | `/conversations/search` | `?locationId&...` | Search conversations |
|  | POST | `/conversations/messages/inbound` | | Add inbound message (external channel) |
|  | POST | `/conversations/messages/{id}/status` | | Update delivery status |
|  | GET | `/conversations/messages/{id}` | | Single message |
|  | POST | `/conversations/providers/...` | | Custom conversation provider |

## Calendars, Events & Appointments

| ✅ | Method | Path | Version | Key params | Notes |
|---|---|---|---|---|---|
| ✅ | GET | `/calendars/` | 2021-07-28 | `?locationId&showDrafted=true` | All calendars |
|  | POST/GET/PUT/DELETE | `/calendars/{id}` | | | Calendar CRUD |
| ✅ | GET | `/calendars/events` | 2021-07-28 | `?locationId&startTime&endTime&calendarId|userId|groupId` | **times = Unix ms**; needs a filter id |
|  | GET | `/calendars/blocked-slots` | | `?locationId&startTime&endTime` | |
| ✅ | GET | `/calendars/{id}/free-slots` | 2021-07-28 | `?startDate&endDate&timezone` | **ms**, range ≤31 days |
| ✅ | POST | `/calendars/events/appointments` | 2021-07-28 | body `calendarId,contactId,startTime,endTime(ISO),title,appointmentStatus,locationId` | **times = ISO w/ offset**; status `confirmed` default |
| ✅ | GET | `/calendars/events/appointments/{id}` | 2021-07-28 | | Single appointment |
| ✅ | PUT | `/calendars/events/appointments/{id}` | 2021-07-28 | body updates + `ignoreFreeSlotValidation:true` | Reassign/reschedule/status |
|  | DELETE | `/calendars/events/{id}` | | | Delete event |
|  | POST | `/calendars/events/block-slots` | | | Create blocked slot |
| ✅ | POST | `/calendars/appointments/{id}/notes` | 2021-04-15 | body `{body,userId?}` | Appointment notes |
|  | GET/POST | `/calendars/groups` | | | Calendar groups |
|  | GET/POST | `/calendars/resources/{type}` | | | Rooms/equipment (`rooms`,`equipments`) |
|  | GET/POST | `/calendars/{id}/notifications` | | | |

appointmentStatus values: `new`, `confirmed`, `cancelled`, `showed`, `noshow`, `invalid`.

## Opportunities & Pipelines  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET | `/opportunities/search` | `?location_id&pipeline_id&...` |
|  | GET/POST/PUT/DELETE | `/opportunities/{id}` | CRUD |
|  | PUT | `/opportunities/{id}/status` | Move stage/status |
|  | POST | `/opportunities/` | Create (body `pipelineId,locationId,contactId,...`) |
|  | GET | `/opportunities/pipelines` | `?locationId` — list pipelines & stages |
|  | PUT | `/opportunities/{id}/followers` | |

## Payments  (**Version 2021-04-15**, `altId`+`altType`)

| ✅ | Method | Path | Notes |
|---|---|---|---|
| ✅ | GET | `/payments/orders` | `?altId&altType&limit&offset` — resp `{data:[]}` |
|  | GET | `/payments/orders/{id}` | Single order |
| ✅ | GET | `/payments/transactions` | Money collected — `{data:[]}` |
|  | GET | `/payments/transactions/{id}` | |
| ✅ | GET | `/payments/subscriptions` | `?altId&altType&contactId?` |
|  | GET | `/payments/subscriptions/{id}` | |
| ✅ | GET | `/payments/coupon/list` | Coupons list |
| ✅ | POST | `/payments/coupon` | Create (body altId/altType + coupon fields) |
| ✅ | PUT | `/payments/coupon` | Update (body includes `id`) |
| ✅ | DELETE | `/payments/coupon` | body `{altId,altType,id}` |
|  | GET/POST | `/payments/integrations/provider/whitelabel` | Custom payment provider |
|  | POST | `/payments/orders/{id}/fulfillments` | Fulfillment |

## Invoices & Estimates  (mostly 2021-07-28; `altId`+`altType`)

| ✅ | Method | Path | Notes |
|---|---|---|---|
| ✅ | GET | `/invoices/` | `?altId&altType&limit&offset` — **offset is a STRING** — resp `{invoices:[]}` |
| ✅ | POST | `/invoices` | body invoice + `locationId` |
|  | GET/PUT/DELETE | `/invoices/{id}` | |
|  | POST | `/invoices/{id}/send` | Send invoice |
|  | POST | `/invoices/{id}/record-payment` | Mark paid |
|  | GET/POST | `/invoices/template` | Invoice templates |
|  | GET/POST | `/invoices/schedule` | Recurring schedules |
|  | GET/POST | `/invoices/estimate` | Estimates |
|  | GET | `/invoices/estimate/number/generate` | Next estimate # |

## Products & Prices  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET | `/products/` | `?locationId` |
|  | POST/GET/PUT/DELETE | `/products/{id}` | CRUD |
|  | GET/POST | `/products/{id}/price` | Prices for a product |
|  | GET/PUT/DELETE | `/products/{id}/price/{priceId}` | |

## Locations (Sub-Accounts)  (2021-07-28)

| ✅ | Method | Path | Notes |
|---|---|---|---|
| ✅ | GET | `/locations/{id}` | Location details — good **connection test** |
|  | GET | `/locations/search` | `?companyId&...` |
|  | POST/PUT/DELETE | `/locations/{id}` | Manage sub-account (agency scope) |
|  | GET/POST/PUT/DELETE | `/locations/{id}/customFields[/{cfId}]` | Custom fields |
|  | GET/POST/PUT/DELETE | `/locations/{id}/customValues[/{cvId}]` | Custom values |
|  | GET/POST/DELETE | `/locations/{id}/tags[/{tagId}]` | Location tags |
|  | GET/POST | `/locations/{id}/templates` | SMS/email templates |
|  | GET/POST | `/locations/{id}/tasks/search` | Tasks |

## Users  (2021-07-28)

| ✅ | Method | Path | Notes |
|---|---|---|---|
| ✅ | GET | `/users/` | `?locationId` — resolve `assignedUserId` → name |
| ✅ | GET | `/users/profile` | Current token's user — connection probe |
|  | GET/POST/PUT/DELETE | `/users/{id}` | User CRUD (agency scope) |
|  | GET | `/users/search` | `?companyId&...` |

## Media Library  (`altId`+`altType`; rename/delete **2021-04-15**)

| ✅ | Method | Path | Notes |
|---|---|---|---|
| ✅ | GET | `/medias/files` | `?altId&altType&type=folder|file` |
| ✅ | POST | `/medias/folder` | Create folder |
| ✅ | POST | `/medias/upload-file` | multipart form (altId/altType/name/file/folderId) |
| ✅ | PUT | `/medias/{id}` | Rename (2021-04-15) |
| ✅ | DELETE | `/medias/{id}` | Delete (2021-04-15, altId/altType as query) |

## Custom Objects & Records  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET/POST | `/objects/` | `?locationId` — schemas |
|  | GET/PUT/DELETE | `/objects/{key}` | Object schema |
|  | POST | `/objects/{key}/records` | Create record |
|  | GET/PUT/DELETE | `/objects/{key}/records/{id}` | Record CRUD |
|  | POST | `/objects/{key}/records/search` | Search records |

## Workflows, Forms, Surveys, Funnels  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET | `/workflows/` | `?locationId` — list (add/remove contact via contacts endpoints) |
|  | GET | `/forms/` | `?locationId` — list forms |
|  | GET | `/forms/submissions` | `?locationId&formId&startAt&endAt` |
|  | POST | `/forms/upload-custom-files` | |
|  | GET | `/surveys/` | `?locationId` |
|  | GET | `/surveys/submissions` | `?locationId&surveyId` |
|  | GET | `/funnels/funnels/list` | `?locationId` |
|  | GET | `/funnels/page` | `?locationId&funnelId` |

## Blogs  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET/POST/PUT | `/blogs/posts` | Blog posts |
|  | GET | `/blogs/authors` | `?locationId` |
|  | GET | `/blogs/categories` | `?locationId` |
|  | GET | `/blogs/site/all` | Blog sites |

## Social Planner, Email, Links, Campaigns  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET/POST | `/social-media-posting/{locationId}/posts` | Social posts |
|  | GET | `/social-media-posting/{locationId}/accounts` | Connected socials |
|  | GET/POST | `/emails/builder` | Email builder templates |
|  | POST | `/emails/verify` | Email verification |
|  | GET | `/emails/schedule` | Scheduled/campaign emails |
|  | GET | `/campaigns/` | `?locationId&status` |
|  | GET/POST/PUT/DELETE | `/links/` | Trigger links |

## Businesses & Companies  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET/POST/PUT/DELETE | `/businesses/{id}` | Business units within a location |
|  | GET | `/businesses/` | `?locationId` |
|  | GET | `/companies/{id}` | Agency/company details |

## SaaS & Snapshots (agency)  (2021-07-28)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET/PUT | `/saas-api/public-api/locations` | SaaS billing/config per location |
|  | POST | `/saas-api/public-api/update-saas-subscription/{id}` | |
|  | GET | `/snapshots/` | `?companyId` — list snapshots |
|  | POST | `/snapshots/snapshot-status/{id}` | Push snapshot |

## OAuth  (auth flow — no Version header on token endpoints)

|  | Method | Path | Notes |
|---|---|---|---|
|  | GET | `/oauth/chooselocation` | (marketplace host) user picks location |
|  | POST | `/oauth/token` | `grant_type=authorization_code|refresh_token` |
|  | POST | `/oauth/locationToken` | Agency→location token exchange |
|  | GET | `/oauth/installedLocations` | `?companyId&appId` |

---

## Extending the client

To add an endpoint to `client.ts`:
1. Find its group above → note the **Version** and whether it uses `locationId` or `altId/altType`.
2. Add a method mirroring the closest existing one (copy a payments method for a 2021-04-15/altId endpoint; a contacts method for a 2021-07-28/locationId one).
3. Read response defensively (`data.x || data.data || []`).
4. Verify against a live account, then mark it ✅ here.

**Source of truth for exact request/response schemas is the live docs** — this catalog gives you the path, method, Version, and scoping param so you know *how* to call it; confirm field names there.


---

# Appendix D — client.ts (drop-in client)

```ts
/**
 * GHLClient — a battle-tested GoHighLevel (HighLevel / LeadConnector) API v2 client.
 *
 * Drop this into any Node/TypeScript backend. Construct ONE instance per request
 * from the stored credential (token + locationId). NEVER instantiate in a browser
 * or mobile bundle — the token is a full-access credential.
 *
 *   const ghl = new GHLClient({ token, locationId })
 *   const contact = await ghl.upsertContact({ firstName, lastName, email, phone })
 *
 * Deps: axios, form-data.  (Swap axios for fetch if you prefer — the header/param
 * rules are the same; just keep the Version header per-endpoint.)
 */
import axios, { AxiosInstance, AxiosError } from 'axios'
import FormData from 'form-data'

const GHL_BASE_URL = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com'

// Default API version. A subset of endpoints REQUIRE '2021-04-15' (payments,
// subscriptions, coupons, orders, transactions, notes, media rename/delete) —
// those pass the header per-call below.
const DEFAULT_VERSION = '2021-07-28'
const PAYMENTS_VERSION = '2021-04-15'

export interface GHLConfig { token: string; locationId: string }

export class GHLClient {
  private client: AxiosInstance
  private locationId: string

  constructor(config: GHLConfig) {
    this.locationId = config.locationId
    this.client = axios.create({
      baseURL: GHL_BASE_URL,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        Version: DEFAULT_VERSION,
      },
      timeout: 30000,
    })
    // Normalize errors so callers get GHL's real message + status.
    this.client.interceptors.response.use(
      (r) => r,
      (error: AxiosError) => {
        const status = error.response?.status || 0
        const message = (error.response?.data as Record<string, string>)?.message || error.message
        throw new GHLError(message, status, error.response?.data)
      }
    )
  }

  // ── Contacts ────────────────────────────────────────────────────────────
  async getContact(contactId: string) {
    const { data } = await this.client.get(`/contacts/${contactId}`)
    return data.contact
  }

  async searchContacts(params: { query?: string; email?: string; phone?: string; limit?: number; page?: number }) {
    const { data } = await this.client.post('/contacts/search', {
      locationId: this.locationId, ...params, limit: params.limit || 100, page: params.page || 1,
    })
    return data
  }

  /**
   * Fetch EVERY contact for the location, following GHL's cursor (falls back to
   * page-based paging). `complete` is true only when we KNOW we reached the end —
   * gate any destructive "archive removed contacts" logic on it, never prune off
   * a partial fetch.
   */
  async getAllContacts(limit = 100): Promise<{ contacts: unknown[]; complete: boolean; total: number | null }> {
    const contacts: unknown[] = []
    let startAfter: string | undefined, startAfterId: string | undefined
    let page = 1, total: number | null = null, complete = false
    while (true) {
      const params: Record<string, unknown> = { locationId: this.locationId, limit }
      if (startAfter || startAfterId) {
        if (startAfter) params.startAfter = startAfter
        if (startAfterId) params.startAfterId = startAfterId
      } else if (page > 1) { params.page = page }
      const { data } = await this.client.get('/contacts', { params })
      const batch = data.contacts || []
      const meta = data.meta || {}
      if (typeof meta.total === 'number') total = meta.total
      if (batch.length === 0) { complete = true; break }
      contacts.push(...batch)
      if (total != null && contacts.length >= total) { complete = true; break }
      if (meta.startAfterId || meta.startAfter) { startAfter = meta.startAfter; startAfterId = meta.startAfterId }
      else if (batch.length >= limit) { page += 1 }
      else { complete = true; break }
      if (contacts.length >= 20000) { complete = false; break } // safety cap
    }
    return { contacts, complete, total }
  }

  /** Upsert by email/phone. Requires at least one of email/phone; phone must be E.164. */
  async upsertContact(contactData: Record<string, unknown>) {
    const payload: Record<string, unknown> = { ...contactData, locationId: this.locationId }
    const phone = normalizePhone(payload.phone)
    if (phone) payload.phone = phone; else delete payload.phone
    if (!payload.email) delete payload.email
    const { data } = await this.client.post('/contacts/upsert', payload)
    return data.contact || data
  }

  async updateContact(contactId: string, updates: Record<string, unknown>) {
    const { data } = await this.client.put(`/contacts/${contactId}`, updates)
    return data.contact
  }

  /** Adding a tag is the canonical way to trigger a tag-based GHL workflow. */
  async addContactTags(contactId: string, tags: string[]) {
    const { data } = await this.client.post(`/contacts/${contactId}/tags`, { tags })
    return data
  }

  async createContactNote(contactId: string, body: string, userId?: string) {
    const { data } = await this.client.post(`/contacts/${contactId}/notes`,
      { body, ...(userId ? { userId } : {}) }, { headers: { Version: PAYMENTS_VERSION } })
    return data
  }

  // ── Calendars & Appointments ────────────────────────────────────────────
  /** All calendars for the location. showDrafted includes personal/draft calendars. */
  async getCalendars() {
    const { data } = await this.client.get('/calendars/', { params: { locationId: this.locationId, showDrafted: true } })
    return (data.calendars || data.data || []) as Record<string, unknown>[]
  }

  /** Events in a range. startMs/endMs are Unix MILLISECONDS. Needs a calendarId/userId/groupId. */
  async getCalendarEvents(startMs: number, endMs: number, calendarId?: string) {
    const params: Record<string, unknown> = { locationId: this.locationId, startTime: startMs, endTime: endMs }
    if (calendarId) params.calendarId = calendarId
    const { data } = await this.client.get('/calendars/events', { params })
    return (data.events || []) as Record<string, unknown>[]
  }

  /** Every appointment across all calendars (the unfiltered call 422s, so fan out). */
  async getAllAppointmentsForRange(startIso: string, endIso: string) {
    const startMs = new Date(startIso).getTime(), endMs = new Date(endIso).getTime()
    const seen = new Set<string>(), all: Record<string, unknown>[] = []
    const calendars = await this.getCalendars()
    await Promise.allSettled(calendars.map(async (cal) => {
      try {
        const events = await this.getCalendarEvents(startMs, endMs, cal.id as string)
        for (const e of events) { const id = (e.id || e.eventId) as string; if (id && !seen.has(id)) { seen.add(id); all.push(e) } }
      } catch { /* per-calendar errors are non-fatal */ }
    }))
    return all
  }

  async getAppointment(eventId: string) {
    const { data } = await this.client.get(`/calendars/events/appointments/${eventId}`)
    return data.appointment || data.event || data
  }

  /** Create an appointment. startTime/endTime are ISO 8601 WITH tz offset (not ms). */
  async createAppointment(payload: {
    calendarId: string; contactId: string; startTime: string; endTime: string
    title?: string; appointmentStatus?: string; ignoreDateRange?: boolean; toNotify?: boolean; ignoreFreeSlotValidation?: boolean
  }) {
    const { data } = await this.client.post('/calendars/events/appointments', {
      ...payload, locationId: this.locationId, appointmentStatus: payload.appointmentStatus || 'confirmed',
    })
    return data.appointment || data.event || data
  }

  /** Update (reassign/reschedule/status). Pass ignoreFreeSlotValidation:true when reassigning. */
  async updateAppointment(eventId: string, updates: Record<string, unknown>) {
    const { data } = await this.client.put(`/calendars/events/appointments/${eventId}`, updates)
    return data.appointment || data.event || data
  }

  /** Real availability. startMs/endMs are Unix ms; range max ~31 days. */
  async getFreeSlots(calendarId: string, startMs: number, endMs: number, timezone?: string) {
    const params: Record<string, unknown> = { startDate: startMs, endDate: endMs }
    if (timezone) params.timezone = timezone
    const { data } = await this.client.get(`/calendars/${calendarId}/free-slots`, { params })
    return data as Record<string, { slots: string[] }>
  }

  async createAppointmentNote(appointmentId: string, body: string, userId?: string) {
    const { data } = await this.client.post(`/calendars/appointments/${appointmentId}/notes`,
      { body, ...(userId ? { userId } : {}) }, { headers: { Version: PAYMENTS_VERSION } })
    return data
  }

  // ── Conversations & Messaging ───────────────────────────────────────────
  async sendMessage(payload: { type: 'SMS' | 'Email'; contactId: string; message?: string; subject?: string; html?: string }) {
    const { data } = await this.client.post('/conversations/messages', { ...payload, locationId: this.locationId })
    return data
  }
  async getConversationMessages(conversationId: string) {
    const { data } = await this.client.get(`/conversations/${conversationId}/messages`)
    return data.messages || []
  }

  // ── Payments: Invoices / Orders / Transactions / Subscriptions / Coupons ──
  // NOTE: these use altId+altType (NOT locationId). Invoices offset is a STRING.
  // Orders/transactions/subscriptions/coupons need Version 2021-04-15.
  async getInvoices(params: { limit?: number; offset?: number } = {}) {
    const { data } = await this.client.get('/invoices/', {
      params: { altId: this.locationId, altType: 'location', limit: params.limit ?? 100, offset: String(params.offset ?? 0) },
    })
    return data.invoices || []
  }
  async createInvoice(invoiceData: Record<string, unknown>) {
    const { data } = await this.client.post('/invoices', { ...invoiceData, locationId: this.locationId })
    return data
  }
  async getOrders(params: { limit?: number; offset?: number } = {}) {
    const { data } = await this.client.get('/payments/orders', {
      headers: { Version: PAYMENTS_VERSION },
      params: { altId: this.locationId, altType: 'location', limit: params.limit ?? 100, offset: params.offset ?? 0 },
    })
    return (data.data || data.orders || []) as Record<string, unknown>[]
  }
  async getTransactions(params: { limit?: number; offset?: number } = {}) {
    const { data } = await this.client.get('/payments/transactions', {
      headers: { Version: PAYMENTS_VERSION },
      params: { altId: this.locationId, altType: 'location', limit: params.limit ?? 100, offset: params.offset ?? 0 },
    })
    return (data.data || data.transactions || []) as Record<string, unknown>[]
  }
  async getSubscriptions(params: { contactId?: string; limit?: number; offset?: number } = {}) {
    const { data } = await this.client.get('/payments/subscriptions', {
      headers: { Version: PAYMENTS_VERSION },
      params: { altId: this.locationId, altType: 'location', limit: params.limit ?? 100, offset: params.offset ?? 0, ...(params.contactId ? { contactId: params.contactId } : {}) },
    })
    return (data.data || data.subscriptions || []) as Record<string, unknown>[]
  }
  async getCoupons() {
    const { data } = await this.client.get('/payments/coupon/list', {
      headers: { Version: PAYMENTS_VERSION },
      params: { altId: this.locationId, altType: 'location', limit: 100, offset: 0 },
    })
    return (data.data || data.coupons || []) as Record<string, unknown>[]
  }
  async createCoupon(body: Record<string, unknown>) {
    const { data } = await this.client.post('/payments/coupon', { altId: this.locationId, altType: 'location', ...body }, { headers: { Version: PAYMENTS_VERSION } })
    return data
  }
  async updateCoupon(body: Record<string, unknown>) {
    const { data } = await this.client.put('/payments/coupon', { altId: this.locationId, altType: 'location', ...body }, { headers: { Version: PAYMENTS_VERSION } })
    return data
  }
  async deleteCoupon(id: string) {
    const { data } = await this.client.delete('/payments/coupon', { headers: { Version: PAYMENTS_VERSION }, data: { altId: this.locationId, altType: 'location', id } })
    return data
  }

  // ── Media Library (altId/altType; rename+delete need 2021-04-15) ─────────
  async getMediaFolders() {
    const { data } = await this.client.get('/medias/files', { params: { altId: this.locationId, altType: 'location', type: 'folder' } })
    return (data.files || []) as Array<{ _id: string; name: string; parentId: string | null }>
  }
  async createMediaFolder(name: string, parentId = '') {
    const { data } = await this.client.post('/medias/folder', { altId: this.locationId, altType: 'location', name, parentId })
    return data as { _id: string; name: string; parentId: string | null }
  }
  async uploadMediaFile(buffer: Buffer, filename: string, contentType: string, folderId?: string) {
    const form = new FormData()
    form.append('altId', this.locationId); form.append('altType', 'location'); form.append('name', filename)
    if (folderId) form.append('folderId', folderId)
    form.append('file', buffer, { filename, contentType })
    const { data } = await this.client.post('/medias/upload-file', form, { headers: { ...form.getHeaders() }, maxBodyLength: Infinity, maxContentLength: Infinity })
    return data as { fileId: string; url: string }
  }
  async updateMedia(id: string, name: string) {
    const { data } = await this.client.put(`/medias/${id}`, { altId: this.locationId, altType: 'location', name }, { headers: { Version: PAYMENTS_VERSION } })
    return data
  }
  async deleteMedia(id: string) {
    const { data } = await this.client.delete(`/medias/${id}`, { headers: { Version: PAYMENTS_VERSION }, params: { altId: this.locationId, altType: 'location' } })
    return data
  }

  // ── Users / Location / connection test ──────────────────────────────────
  async getUsers() {
    const { data } = await this.client.get('/users/', { params: { locationId: this.locationId } })
    return (data.users || data || []) as Array<{ id: string; name?: string; firstName?: string; lastName?: string; email?: string }>
  }
  async getUserProfile() { const { data } = await this.client.get('/users/profile'); return data }
  /** Cheap authenticated call — use to validate a token+locationId on connect. */
  async getLocation() { const { data } = await this.client.get(`/locations/${this.locationId}`); return data.location }
}

/** Coerce a free-form phone to E.164 ("+15551234567"), which GHL requires. */
export function normalizePhone(input: unknown): string | undefined {
  if (input == null) return undefined
  const raw = String(input).trim(); if (!raw) return undefined
  const digits = raw.replace(/[^\d]/g, ''); if (!digits) return undefined
  if (raw.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

export class GHLError extends Error {
  status: number; data: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message); this.name = 'GHLError'; this.status = status; this.data = data
  }
}

```
