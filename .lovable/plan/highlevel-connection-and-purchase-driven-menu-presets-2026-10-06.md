# HighLevel connection and purchase-driven menu presets

## What changes for agencies
- New **Settings > Integrations > HighLevel**: enter Company ID and Agency Private Integration Token (hidden, never shown again), Connect/Test, Replace Token, Disconnect, status with verified company name and last sync.
- **Menu Link Removal** gets a searchable sub-account picker (name + ID) from their HighLevel account, keeps manual ID entry (checked against their company), and shows whether their onboarding custom link exists for that sub-account.
- **Set Up Automation** shows a one-time secret, the endpoint, the header, the request body, and workflow variable instructions. Secret can be revoked/rotated.
- **Automation activity log**: queued, retrying, applied, needs review, failed — with a "resolve" action that picks the right sub-account and remembers it for future purchases.

## How a purchase applies a preset
1. HighLevel workflow calls `apply-menu-preset` with the secret header, buyer email, preset name, event ID, product ID (location ID optional).
2. Secret is checked first; it decides the agency. Product to preset mapping is checked server-side.
3. Sub-account is found by: explicit/saved mapping, else exact email match in their company, reading that user's assigned sub-accounts.
4. Exactly one sub-account (and enabled in the config): apply. None yet: retry in the background. Several: needs review, nothing applied. Never all sub-accounts, never an agency-wide rule.
5. Same event ID is applied only once; a reused ID with different data is rejected. Plan changes replace only rules created by that automation.

## Live styling
- The installed script tags the page with the current sub-account ID and updates it on navigation; removal styles target only that exact ID. Branding untouched. Paused/changed rules refresh immediately.

## Existing callers
- Current workflows that call without a secret keep working during a transition window with a banner asking them to add the secret; after that window, unsecured calls are rejected. No permanent bypass.

## Technical details
- Tables (backend-only, no browser access): `ghl_connections` (company_id, AES-256-GCM ciphertext + nonce + key version, agency-bound associated data, status, company name, last_sync), `ghl_locations_cache`, `ghl_custom_menus_cache`, `menu_automations` (secret hash, allowed preset/product map, single-location policy), `menu_automation_events` (unique agency+automation+event_id, payload hash, status, attempts, next_run_at, sanitized error), `location_mappings`. Sanitized status exposed via owner/admin RPCs checked against `can_access_agency` and `useTeamAccess`.
- Server secret `GHL_TOKEN_ENC_KEY` (generated). One shared GHL client in `_shared/ghl.ts` (Version v3, pagination, timeouts, 429/backoff with jitter, partial sync never treated as empty).
- Edge functions: `ghl-connection` (connect/test/rotate/disconnect/sync), `apply-menu-preset` (extended), `menu-automation-worker` on a cron for retries.
- `dynamic-styles` JS sets `data-ss-location` on the page root; CSS rules scoped to `[data-ss-location="<escaped id>"]` with selectors from the allowlisted catalog.
- Tests: Deno tests for email exact-match, multi-page results, replay/conflict handling, cross-agency rejection, secret never in responses or CSS/JS. A full sandbox purchase test needs a real HighLevel test company and token from you.
- Review the "$497 required" note on the automation screen against current plan access.
