# Seed demo data for test@test.com

Goal: make the test account's dashboards (Dashboard overview, SaaS Health, Activity, Support) look like a healthy, active agency instead of an empty shell.

## Confirmed current state

- `test@test.com` exists, plan STARTER, approval YES, and its only agency ID is `a743d34996b944f4bc91beb15ab6c11b` (stored in `agency_id_basic`).
- For that agency ID there are currently **0 rows** in `user_progress`, `agency_onboarding_checklist`, `user_onboarding_checklist_completion`, `support_tickets`, and `chat_threads` — so every dashboard reads as empty.
- The dashboard derives: new users from `user_progress.created_at`, logins from `user_progress.last_accessed`, onboarding events from `module_completion.completed_at` + `user_onboarding_checklist_completion.completed_at`, tickets from `get_agency_tickets`, and chat volume from `chat_threads`.

## What gets seeded (data only, no code changes)

1. **162 example client users** in `user_progress` for that agency ID
   - Realistic first/last names and emails on varied fake business domains (e.g. `sarah.klein@northpeakdental.com`), approval YES.
   - `created_at` spread over the last ~120 days with a gentle upward ramp so recent weeks show more signups than older ones.
   - `last_accessed` spread across the last 30 days, weekday-heavy: roughly 60% active in the last 7 days, 25% 8–30 days, 15% dormant — so active-user percentages and the logins line look healthy and varied rather than flat.

2. **An 8-item onboarding checklist** in `agency_onboarding_checklist` for the agency (connect account, add branding, import contacts, set up calendar, launch first automation, invite team, connect payments, go live), so completion percentages have a denominator.

3. **Onboarding completion** rows
   - `user_onboarding_checklist_completion` per user with a realistic funnel: ~35% finished all 8 items, ~40% partway (2–6 items), ~25% barely started (0–1).
   - `completed_at` staggered across the last 45 days and always at/after the user's signup date, so the onboarding line has daily variation.
   - Overall average completion lands around 65–70%.

4. **Video/module engagement** in `module_completion` for a subset of users, using real category/module IDs from the app's video categories, so "videos completed" and "most watched video" show real values.

5. **Support activity**
   - ~14 `support_tickets` across mixed categories with a spread of statuses (open, waiting on customer, closed) so the Open Support Tickets card shows a believable split.
   - ~30 `chat_threads` with message counts and recent timestamps, a couple with an unresolved handover.

## Technical notes

- All done via data inserts keyed to `agency_id = 'a743d34996b944f4bc91beb15ab6c11b'`, generated with `generate_series` plus deterministic pseudo-random offsets so the spread is varied but reproducible.
- Timestamps are relative to `now()`, so the data stays "recent".
- No production accounts touched and no application code changes needed.
- Easy to remove later: everything is scoped to that one agency ID, so deleting by it fully cleans up.