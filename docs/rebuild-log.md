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
