# saas-suite-rebuild: rules for this repository

This is a **copy** of SaaS Suite made for one test: can an agent rebuild the platform's UI from a component library?
It is not the live app. The live app and its repository are separate and must never be touched from here.

## What you may do
- UI work only: layouts, components, styling, animations, copy on screen, and the front-end code that renders them.
- Use the components in `andrewpreneur/andrews-components` and from 21st.dev (watch the animations on 21st.dev before using them).
- Run the app locally, take screenshots, write tests for the UI.

## Never
- **This copy is disconnected from Supabase and must stay that way.** `supabase` in
  `src/integrations/supabase/client.ts` is always the in-memory mock (`src/lib/platformMock.ts`), there is no project
  URL or key anywhere, and `src/lib/backendDisconnected.ts` blocks live hosts and trackers at the network level.
  Never add a Supabase URL, key, or any call to the live app. `tests/rebuildDisconnected.test.ts` enforces this.
- No database migrations, no SQL, no function deploys. `supabase/` is kept only because the front end imports a few
  shared files from it; `supabase/config.toml` is unlinked on purpose.
- No server keys in the environment (service role, Stripe, HighLevel).
- Never push straight to `main`. Work on a branch and open a pull request in **this** repository only. Andrew has
  approved merging those pull requests into this repository's `main` (Nov 13, 2026).
- Never touch the live `andrewpreneur/saas-suite` repository from here.

## Good to know
- Read `AGENTS.md` (project decisions) before changing files; subfolders may have their own.
- There is one UI: "SaaSSuite Premium" (design system v1). Read `docs/design-system.md` before changing any screen and
  follow it: tokens in `src/index.css`, motion presets in `src/lib/motion.ts`, primitives in `src/components/ui`, premium
  pieces in `src/components/premium` (21st.dev components live in `premium/21st`, each credited at the top of its file).
- `docs/rebuild-log.md` records what was rebuilt and what is left; `docs/rebuild/` holds screenshots and the walkthrough video.
- This copy is **not connected to Lovable**: the Lovable publish workflow and script were removed (they pointed at the live
  project). Don't add any deploy or publish step that targets the live app.
- All trackers are off in this copy: the Ospry tag is removed and `index.html` sets the tracking opt-out before anything
  loads, so test clicks never reach the real numbers. Leave them off.
- New screens need mock data: add fixtures to `src/lib/platformMock.ts` rather than reaching for a real backend.
