# Platform polish, verification and UX pass

Broad request, split into phases so each can be tested before moving on. Each phase ends with a short report of what works, what was fixed, and what still doesn't.

## Phase 1 — Verify core flows (audit + fixes)
- **Purchase and signup:** run every checkout entry (pricing, special, webinar, add-ons, courses, onboarding calls) through to the confirmation page in a test browser. Check redirects: signed in vs. new buyer, `/app?confirmed=true`, `/signup?paid=true`, and that tracking params survive.
- **Walkthrough:** run the first-time tour end to end (Client Hub → Education → Install → menu links). Fix any step that doesn't advance. Re-test Suzi's step 6.
- **Admin webhooks:** ping each saved support/ticket/chat/assignee/team-reply webhook with a clearly labeled test payload. Report which respond and which fail or are missing.
- **Output:** a status list of each feature: works / fixed / broken (needs your input).

## Phase 2 — Explain the product
- **Tooltips everywhere:** add at least one hover tooltip (info icon) to every section header in the app sidebar areas: Dashboard, Client Hub, Education, Support, Workflows, Settings, Onboarding Calls, Branding, and the rest.
- **Installation guide, 3-step card:** a visual card at the top of the guide:
  1. Menu links: one per plan, where to add them in HighLevel.
  2. JavaScript + CSS: what the install code does and where it goes.
  3. Updates: changes you make in SaaS Suite push to HighLevel automatically (hard refresh to see them).
- The first-time walkthrough links to this card.

## Phase 3 — Smarter AI Copilot
- Before any change: look up the current setup, ask a clarifying question when the request is ambiguous (which plan, which ID), and show a short "Here's what I'll change — confirm?" step before writing.
- **No hallucinations:** after each change, the Copilot re-reads the saved setting and only reports success if it matches. Otherwise it says what failed.
- Log any claimed-but-not-verified action for review in the admin Copilot panel.

## Phase 4 — Mobile and page cleanups
- **Mobile dashboard:** friendlier stacked cards, larger tap targets, readable stats.
- **Bulk actions on the dashboard users list:** checkboxes, "select all", then bulk edit (plan/access) or bulk delete with a confirmation step.
- **Workflows page:** triggers become the main content (a clean list with on/off switches). Slack/custom messages move into a collapsible "Slack messages" dropdown per trigger. Long explanatory text moves into tooltips.
- **Support ticketing:** simpler layout. One list with filters (Open / Assigned to me / Closed), the assign icon inline, and fewer columns on mobile. The old Support Features ticket list switches to the same assign icon.
- **Client Hub editor on mobile:** vertical layout, titles and buttons wrap and stack instead of squishing, full-width controls under 640px.
- General UX sweep for spacing, overflow, and button stacking on small screens.

## Phase 5 — Testing
- A Playwright check script for: checkout redirects, signup, the walkthrough, the Copilot verify loop, mobile layouts (390px screenshots), workflows, and the bulk select.
- A final report of non-functional features and recommended improvements.

## Technical notes
- Tooltips use the existing shadcn Tooltip with a shared `InfoTip` component.
- The Copilot verify step lives in `chat-copilot`: a post-write read-back per tool, plus a `requires_confirmation` flag for write tools so the existing ActionConfirmation UI is used.
- Bulk delete reuses the existing delete RPCs (`delete_agency_client`) in a loop with a progress toast. There are no new tables.
- Webhook pings go through a small admin-only edge function so the URLs stay server-side.

## Order and checkpoints
I'll do Phase 1 first and send you the status list. Phases 2–4 follow, and Phase 5 runs at the end. Large changes to page layout (Workflows, Support) will be shown in screenshots before I finish.
