# Rebuild log

Overnight job, Nov 13, 2026 (Andrew's brief): rebuild the SaaSSuite UI in this copy so it is simple, premium and smooth,
using 21st.dev components, `andrews-components` and our UX rules. Work only in this repository; never Supabase.

## Done
- Disconnected from Supabase and all trackers (PR #1). `tests/rebuildDisconnected.test.ts` keeps it that way.
- Old UI and the admin switch removed: one UI.
- Design system v1 "SaaSSuite Premium": tokens, surfaces, motion presets (`docs/design-system.md`, `src/lib/motion.ts`).
- Shell: glass top bar with a trail and a Cmd+K jump menu, page transitions, sidebar with sliding pills and animated
  icons, phone quick nav, toasts moved to the top right.
- Rebuilt areas: sign in / sign up / reset / account picker / 404 and all banners; onboarding (first questions and the
  7-step setup wizard, install checklist and guide); Dashboard, Affiliate, One Feature Kit, Challenge; Hub Pages,
  Simplified Onboarding, Knowledge Base, Workflows; Branding and Menu Link Removal; Client Support, Customize Support,
  Onboarding Calls, Agency Support; Copilot (page, dock, launcher); Learning Hub, Walkthrough, tour tooltip, Community,
  Agents, Settings, Email Warmup, Free Leads; a consistency sweep of dialogs and leftovers.
- `/admin/design-system` shows the live tokens and components.

## 21st.dev components in use
Wizard Steps, Animated Tabs, Expandable Tabs, Number Ticker, Spotlight, Folder Card, Empty State, Animated List (rows),
Text Shimmer, Animated State Icons, Halo Dropzone, AI Prompt Box (adapted as `premium/copilot/CopilotPromptBox`).
Used as the basis for our own pieces: Animated Sidebar (sliding pills), Command Palette (Cmd+K menu), Floating Gradient
(entry and onboarding backdrop). In the repo but unused: Animated Icon.

## Checks at hand-off
- `npx tsc --noEmit -p tsconfig.app.json`: 0 errors.
- `scripts/verify-branding-fixes.mjs`: 23 of 23.
- 32 screens at 1440 and 390 wide: no horizontal overflow, no page errors.
- Network sweep of 27 screens: no request to Supabase, the live backend or any tracker.
- `bun test`: 22 failing, the same set as right after the disconnect (tests written against the live backend).

## Not done or not verified
- Marketing, funnel and public Client Hub pages were not redesigned.
- Most saves, uploads, checkouts and less common dialogs were not clicked through; screens were judged from screenshots.
- The interactive tour skips its sidebar steps on phones (existing behaviour).
- Stripe.js still loads on checkout screens. The legacy `OnboardingTool` and other unreachable code were left alone.
- Two accent buttons appear on Community Ideas (empty state) and Menu Link Removal.
- Pages that hold several jobs behind tabs (Hub Pages, Branding, Client Support) are clearer but still single pages.

## How to preview
`npx vite dev --host 127.0.0.1 --port 5210`, then open `/app/dashboard`. The demo account is built in; no login, no backend.
Useful previews: `/login?preview`, `/initial-questions`, `/v2-onboarding`, `/admin/design-system`,
`/app/dashboard?ss_mock_chrome=trial.offer` (banner states: past_due, grace, cancel, limit, trial, offer, suspended, team).

## Round 2: calm screens and the Glass skin (Nov 13, 2026)

Andrew's note on round 1: "Screens still have a LOT on them. Lots of buttons and places to go." Rules are in
`docs/design-system.md` ("Calm screens" and "Skins").

### Done
- Navigation: sidebar is Dashboard plus five groups, one open at a time (was 20 links). The page name in the top bar
  switches between pages in the same group. Search is a small button; the finished install checklist is a tick.
- Dashboard: next step, hub link, one strip of numbers, then three views (Workspace folders, Clients, Insights).
- Every page: one primary button, the rest in a "..." menu; settings are one card of rows that open a side panel
  (bottom sheet on phones); stat cards became a slim strip or were removed where a tab already shows the count.
  Rough count of clickable things when a page loads, before and after: Hub Pages 25 to 6, Branding 20 to 5,
  Client Support 20 to 9, Settings 20 to 4, Learning Hub 20 to 5, Affiliate 38 to 7, One Feature Kit 22 to 7.
- Glass skin: a Clean / Glass switch in the top bar and phone header (`src/lib/skin.ts`, CSS only).
- New 21st.dev components: Glassmorphism Folder Cards (dashboard workspace, Learning Hub trainings, One Feature Kit
  add-ons), Theme Switcher (basis of the skin switch). Glass Card is in the repo but not used yet.
- The floating Copilot button hides while a panel or dialog is open. Panels return focus to the row that opened them.

### Checks
- `tsc`: 0 errors. `bun test`: 22 failing, the same backend-only set as before (two wording tests were updated).
- Branding checks: `tests/designPageModel.test.ts` 19 of 19, `scripts/verify-branding-fixes.mjs` 23 of 23.
- 23 screens in Clean and Glass at 1440 wide, 22 in Glass at 390 wide: no page errors, no horizontal overflow.

### Not done or not verified
- Guided tour: steps that point inside Hub Pages panels (`v3-home-video-thumbnail`, `v3-home-add-announcement`,
  `v3-home-add-sections`) need retargeting; the tour was not re-run end to end.
- `scripts/verify-design-page.mjs`, `verify-design-access.mjs` and probably `verify-theme-customizer.mjs` still click
  the removed Branding step tabs (`design-tab-*`; rows are now `design-row-<id>`) and need updating.
- Hub Pages "Assign to Sub Account" tab is unchanged. Hub Pages Education shows 8 clickable things (budget is 7).
- States with no demo data were not looked at: Affiliate apply form, Email Warmup and Free Leads after submitting,
  Branding when the script is not installed, Learning Hub with setup incomplete.
- Most "..." menu items, several panels, and actual saves in Support and Grow were not clicked through.
- Slack and HighLevel rows in Settings describe the integration; they do not show Connected / Not connected.
- Glass has no dark version. Folder labels are small on phones (readable buttons appear under an open folder).
- A live Stripe publishable key is hard-coded in `OnboardingCallsManager.tsx` and `AgencySupportManager.tsx`
  (from the original code). Publishable keys are public by design, but Andrew should decide whether to strip it.

## Round 3: Settings as pages, done moments, phone bar (Nov 13, 2026)

Andrew: "i don't like the right hand settings slide in", "the walkthrough at the end of it it should go to the
highlevel connection", and yes to four more 21st.dev pieces.

### Done
- Settings: each row opens its own page (back link, title, one card) instead of a side panel (`SettingPages` in
  `premium/SettingList`). The open page is in the URL, so browser Back works. Every Settings screen was redesigned:
  Profile, Agency logo, Admins, Billing, Custom Domain, Language, Slack (three tabs became one page), HighLevel,
  Connect external platform, Delete account. Shared pieces: `premium/settings/Page.tsx`.
- Walkthrough: every variant ends on a "Connect HighLevel" step, and Finish tour opens `/app/highlevel`.
- 21st.dev: Task Checkbox and Confetti (install checklist), Bottom Menu (basis of `premium/MobileBottomBar`, which
  replaced the phone icon row), Skeleton shimmer (basis of `premium/PageSkeleton`, shown while the app or a route
  loads), Glass Card (dashboard "Your next step" in the Glass skin).
- Mock additions for Settings states: `ss_mock_chrome` flags `domain`, `slack`, `external`, `hl_off`.

### Checks
- `tsc` 0 errors, build passes, `bun test` 22 failing (same backend-only set).
- Scripts: Settings navigation 58 checks pass; tour ends on `/app/highlevel` for the nav tour and the hub tour.

### Not done or not verified
- Side panels are still used outside Settings (Hub Pages, Support, Grow); Andrew has not said whether to change those.
- Page skeletons were not seen on screen (demo data loads too fast). "Saving" button labels likewise.
- Glass Card is not on the Billing plan card yet.
- Slack and HighLevel rows show real status only after their page has been opened once in the session.
- Slack install link goes nowhere in this copy (it was built from the removed backend URL).
