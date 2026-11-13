# Agency Support: 30-day lock, full client details, admin agency page

## What changes for agency owners

**Before they can assign anyone**, the Agency Support screen asks for their white-label domain (e.g. `app.theirdomain.com`). This is saved once and editable later.

**Assigning a client now collects full details, all required:**
- Name
- Email
- Phone number
- Company name
- Location ID (their GHL sub-account ID)

The old quick "name + email" add row and the CSV import are replaced by a single "Add client" form that requires every field, so no half-filled clients can exist. Picking an existing agency user pre-fills name and email but still requires phone, company and location ID.

**30-day lock on assignment.** A confirmation prompt appears before a client is assigned, spelling out that the account is locked to that client for 30 days and cannot be moved or freed until then. Once confirmed, the toggle for that client is disabled and shows the unlock date (e.g. "Locked until Oct 18"). Removing a locked client is also blocked with the same explanation. After 30 days the toggle works as before.

## What changes for admins

**New page `/admin/agency`** listing every agency owner who has bought Agency Support accounts:
- Owner name, email, plan, agency ID, white-label domain
- Seats purchased vs assigned, and unassigned count
- Each assigned client row: name, company, email, phone, location ID, assigned date, lock status/unlock date
- Each client links to `https://<owner white-label domain>/v2/location/<location id>` in a new tab; when the domain or location ID is missing the link is replaced by a note saying which field the owner still needs to provide
- Search across owner, client, company and location ID

**On `/admin/support`** a new "Agency support accounts" section shows the same customer → sub-account listing (collapsed per owner, with the same deep links), alongside the existing agency support messages panel.

## Technical notes

Migration on `public.agency_support_clients`: add `client_phone text`, `client_company text`, `location_id text`, `locked_until timestamptz`. Add `white_label_domain text` to `public.saas_suite_users`.

Function updates (all SECURITY DEFINER, existing signatures extended with defaulted params so nothing else breaks):
- `upsert_agency_support_client` — accepts phone, company, location id; rejects blank phone/company/location for new rows
- `set_agency_support_client_active` — on activate, sets `assigned_at = now()` and `locked_until = now() + interval '30 days'`; on deactivate, returns `{ok:false, error:'locked', locked_until}` when `locked_until > now()`
- `delete_agency_support_client` — refuses while locked
- `get_agency_support_clients` — returns the new columns
- new `admin_list_agency_support_accounts()` — admin-only (checks `andrew@dna-media.net` via existing admin email check), returns owners with wallet counts, white-label domain and their client rows
- new `set_white_label_domain(_email, _domain)` — normalizes to a bare host (strips scheme, path, trailing slash)

Frontend: `AgencySupportManager.tsx` (domain gate, required-field form, lock confirm dialog via `AlertDialog`, lock-aware toggle/remove), new `src/pages/AdminAgency.tsx` + lazy route `/admin/agency` in `App.tsx`, new `src/components/admin/AgencySupportAccountsPanel.tsx` shared by both admin surfaces.
