# saas-suite-rebuild: rules for this repository

This is a **copy** of SaaS Suite made for one test: can an agent rebuild the platform's UI from a component library?
It is not the live app. The live app and its repository are separate and must never be touched from here.

## What you may do
- UI work only: layouts, components, styling, animations, copy on screen, and the front-end code that renders them.
- Use the components in `andrewpreneur/andrews-components` and from 21st.dev (watch the animations on 21st.dev before using them).
- Run the app locally, take screenshots, write tests for the UI.

## Never
- **Never change customer data or settings in the database.** This copy still points at the live Supabase project (the
  browser key in `.env`), so treat every database call as live: read-only while testing, and only with test accounts.
- No database migrations, no SQL, no changes under `supabase/migrations` or `supabase/functions`, no function deploys.
- No server keys in the environment (service role, Stripe, HighLevel); you don't need them for UI work.
- Never push to `main`. Work on a new branch and open a pull request in **this** repository only.
- Don't change billing, payments, auth or permission logic, even if a screen you're restyling calls it.

## Good to know
- Read `AGENTS.md` (project decisions) before changing files; subfolders may have their own.
- The app already has an opt-in new UI (design system v0.1, `src/lib/uiVersion.ts`, components in
  `src/components/ui/ds`, tokens in `src/index.css`). Build on it rather than starting a third system, unless the task says otherwise.
- This copy is **not connected to Lovable**: the Lovable publish workflow and script were removed (they pointed at the live
  project). Don't add any deploy or publish step that targets the live app.
- Analytics (PostHog) is switched off in this copy (`VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY` is empty) so test clicks
  don't show up in the real numbers. Leave it off.
