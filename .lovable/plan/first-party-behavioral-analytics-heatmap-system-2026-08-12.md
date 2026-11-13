# First-Party Behavioral Analytics & Heatmap System

## Goal
Extend the existing `site_analytics_events` pipeline so we can see not just pageviews, but how users actually interact with pages: video watch retention, click heatmaps, time-on-element, and per-plan behavior. Phase 1 builds heatmaps and video retention; Phase 2 adds full session replay.

## Current foundation
- `src/components/SiteTracker.tsx` already fires `pageview`, `click`, `scroll_depth`, `video_play`, and `exit` events, but only on marketing pages (`/app`, `/admin`, etc. are excluded).
- `supabase/functions/track-site-event/index.ts` receives events and writes to `site_analytics_events`.
- `supabase/functions/page-analytics-api/index.ts` exposes a read-only API for external consumption.
- `site_analytics_events` has a `metadata` JSONB column we can use for coordinates, video progress, element selectors, etc.

## Phase 1 — Enhanced tracking (this plan)

### 1. Database: add identity & engagement columns
Add nullable columns to `site_analytics_events`:
- `user_email` (already exists) — populate for logged-in users.
- `plan_type` (text, nullable) — `STARTER`, `BASIC`, `ADVANCED`, or derived agency-support flag.
- `is_app_page` (boolean, default false) — distinguishes `/app/*` behavior from marketing pages.
- `session_replay_id` (uuid, nullable) — links events to a future replay session.

Also create indexes for fast admin queries:
- `(created_at, path)`
- `(session_id, created_at)`
- `(plan_type, created_at)`

### 2. Frontend: unified tracker for marketing + app pages
Refactor `SiteTracker.tsx`:
- Remove the hard marketing-only exclusion; instead tag events with `is_app_page` when the path starts with `/app`, `/admin`, `/v2-onboarding`, etc.
- Keep the existing `/app` etc. opt-out for the public API if desired, but allow internal admin views to query app-page events.
- For logged-in users, read the current user's email and plan from the existing user context/profile and attach them to every event.

### 3. Video retention tracking
On the landing page hero video only:
- Fire `video_play` on first play.
- Fire `video_progress` at 25%, 50%, 75%, 95% milestones per session.
- Fire `video_complete` when the video ends.
- Store `currentTime`, `duration`, and `percent` in `metadata`.
- Also track pause, seek, and replay counts.

### 4. Click heatmap data
Enhance the existing click handler in `SiteTracker.tsx`:
- Capture `clientX`, `clientY`, `viewport.width`, `viewport.height`.
- Capture the target element's selector path (tag + id/classes, truncated).
- Store in `metadata` as `click_coordinates` and `element_selector`.
- Add a new event type `hover_intent` (optional, throttled) that samples mouse position every 500ms while the page is active, so we can build "time spent looking at areas" heatmaps without full mousemove spam.

### 5. Scroll / viewport engagement
- Keep the existing 25/50/75/100 scroll milestones.
- Add `element_visible` events for key sections (hero, pricing, features, CTA) using IntersectionObserver, so we know which sections keep people on the page longest.
- Store `time_visible_ms` per section in `metadata`.

### 6. Edge function: write enhanced events
Update `track-site-event`:
- Accept and persist the new fields (`plan_type`, `is_app_page`, `metadata` sub-fields).
- Validate that `metadata` is an object and cap its serialized size (e.g., 10KB).
- Keep the existing IP hashing and privacy-safe visitor key.

### 7. Admin view: analytics dashboard
Create or extend an admin analytics page:
- Top pages by plan type.
- Heatmap overlay selector: pick page, date range, device type; show click density and time-on-section.
- Video retention funnel: plays → 25% → 50% → 75% → complete.
- Per-plan comparison table: which plans spend longest on which pages/sections.

## Phase 2 — Session replay (future plan, not in this implementation)
- Snapshot DOM state at page load and on significant mutations.
- Store compressed snapshot stream in a new `session_replays` table.
- Rebuild player that replays events + DOM snapshots.

## Out of scope for this plan
- Third-party analytics (PostHog/GA) — we are building first-party only.
- Recording audio/video from the user's camera/microphone — not part of this.
- Tracking users on external sites or via cookies — first-party, same-site only.

## Verification
- Trigger events on the landing page and confirm rows appear with `metadata` populated.
- Confirm logged-in app users have `user_email` and `plan_type` attached.
- Confirm admin dashboard renders heatmap and video retention data.
