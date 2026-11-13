# Rebuild log

Overnight job started Nov 13, 2026 (Andrew's brief): rebuild the SaaSSuite UI in this copy so it is simple, premium and
smooth, using 21st.dev components (10+), `andrews-components` and our UX rules. Priorities: onboarding, the app itself,
components and motion. Finish with screenshots and a walkthrough MP4. Work only in this repository; never Supabase.

## Done
- [x] Disconnected from Supabase and all trackers (PR #1, merged).
- [x] Old UI and the admin switch removed; one UI.
- [x] Design system v1 "SaaSSuite Premium": tokens, surfaces, motion presets (`docs/design-system.md`, `src/lib/motion.ts`).
- [x] 16 components from 21st.dev in `src/components/premium/21st`.
- [x] Shell: glass top bar with trail and ⌘K jump menu, page transitions, sidebar sliding pills and animated icons.
- [x] App images copied into `public/__l5e` so they load without Lovable.

## In progress (one helper per area, all following docs/design-system.md)
- [ ] Onboarding (setup wizard, first questions, install guide)
- [ ] Dashboard, Affiliate, One Feature Kit, Challenge
- [ ] Hub Pages, Simplified Onboarding, Knowledge Base, Workflows
- [ ] Branding, Menu Link Removal
- [ ] Client Support, Onboarding Calls, Agency Support
- [ ] Copilot
- [ ] Learning Hub, Walkthrough, Community, Agents, Settings
- [ ] Sign in, sign up, account picker

## Then
- [ ] Review every screen at 1440 and 390, fix overflow and inconsistencies
- [ ] Screenshots + walkthrough MP4
- [ ] Final report: what changed, 21st.dev components used, what is left

## How to preview
`npx vite dev --host 127.0.0.1 --port 5210`, then open `/app/dashboard`. The demo account is built in; there is no login and no backend.
