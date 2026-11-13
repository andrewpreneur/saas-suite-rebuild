# Copilot live acceptance checks — SaaSSuite

## Current verified result (November 6, 2026)

- 111 targeted regressions across 14 suites passed (486 assertions), covering session-token handling, truthful outcomes, impossible CSS, human requests, handover payloads, quiet mode, streams and theme authorization.
- A supplemental run passed 34 tests across billing, activity, public Copilot and failure-reporting suites; four failure-reporting tests overlap the primary run (141 distinct tests total).
- Ticket reply checks passed three additional repeats after correcting an inaccurate test: the database deliberately places a team reply one microsecond after a customer reply, but decoded JavaScript Dates cannot preserve that precision. Production behavior was not changed.
- The real preview `/app/copilot` route redirected to `/login?next=%2Fapp%2Fcopilot` with no browser runtime errors. This verifies the login gate, not signed-in behavior.
- Live read-only inspection identified SaaSSuite's `saassuite` and `saassuite-2` plan IDs. One `admin_reply` message exists in the last seven days across Copilot conversations; this does not establish its sender was Grok, successful notification, or customer receipt.

## Required live checks — not yet passed

Use the actual SaaSSuite owner account through normal sign-in. Never use a service-role token as the customer identity, paste credentials into chat, or disable account protections. Lovable cannot restore an authenticated session for this external Supabase connection; signing into the preview does not inject a session into the testing sandbox.

| Check | Input/action | Required evidence |
| --- | --- | --- |
| Real read-only account question | Ask which SaaSSuite Client Hub plans and sections are currently configured | Answer agrees with saved agency settings; no invented configuration or write action |
| Unsupported favicon change | Ask to change the browser-tab icon using CSS | Explains CSS cannot perform the change; saved custom CSS remains unchanged |
| Unverified HighLevel setting | Ask where “Agency Admin Access” or a “Favicon URL” field is | Does not assert the known invented setting exists or provide guessed click instructions |
| Confirmed setting change | In a preselected test plan, approve a reversible Client Hub setting change; record its original value first | Stored value changes, the customer Hub reads it back, reload preserves it; restore and read back the original value |
| Human request, every signed-in surface | Use a unique test marker and ask for a human from workspace Copilot and the Help chat | Honest delivery state, no redirect to public AI, no unsupported assignment/response-time promise; AI pause behavior matches saved status |
| Global handover receipt | Inspect the configured receiving service for that same marker | Exactly one accepted handover per applicable dedupe window, `surface: copilot`, `thread_id: copilot:<owner email>`; evidence of reception, not merely a local claim |
| Grok reply | Receiving bot reads `/copilot/chat`, then sends an authorized `/copilot/reply` with the marker | Reply stored with `admin_reply`, visible in the customer's actual conversation without reload and after reload; notification result accurately reported |
| Customer follow-up | Reply to the human's question | Follow-up stays with human support during quiet mode; explicit request to resume AI works without lifting an indefinite manual pause |
| Failure behavior | Exercise failed handover/status read in an isolated test environment | Does not claim delivery, open a fake ticket, invent a person, or treat failure as permission to overwrite data |

Record timestamp, surface, marker, expected value, stored readback, receiving-service acknowledgement, and visible UI result for each check. Do not store tokens, webhook authentication values, or connection credentials in the evidence.

## Release boundary

These checks are an acceptance checklist, not completed live testing. An MCP transport would not itself solve hallucination: verified tool results, scope enforcement, confirmation and readback remain necessary. Andrew chose to focus on Copilot testing; MCP creation and switching Copilot remain on hold. No MCP server, credentials, customer configuration or publishing changes were made in this verification pass.