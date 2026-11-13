# Bulletproofing the Activity Follow-Up Email

## What this email is for

Two jobs, one system:

1. **First-touch recapture** — after a new user's first meaningful burst of activity: a short welcome, a plain recap of what they actually did, where they appear to have dropped off (initial questions, phone step, mobile-only so never installed, agency ID set but stylesheet not installed, etc.), one clear suggestion, then a question offering help plus the success call link `https://saassuite.ai/success`.
2. **Returning-user nudge — max once per week per person** — what they worked on, what stalled them, 1-3 concrete next actions, plus one "did you know you can…" tip that is correct for their plan.

## Problems to fix

- **Progress is invisible to the AI.** Only 5 events are tracked anywhere in the app (agency name saved, colors saved, branding installed, menu link copied/installed). There is no login event, no page views, no initial-questions step events. So an email cannot honestly say "you stopped at the phone number question" — that data isn't captured. This is the core reason past emails were generic or blank.
- **No per-user send cadence.** Frequency is tracked per session (`email_sent` on `user_activity_sessions`), not per user, so one person with several stale sessions gets several emails.
- **No test/junk blocklist.** `test@test.com`, `@example.com`, `@hmail.com` addresses were emailed.
- **Welcome vs returning is decided by heuristics** (account age, login count) rather than an explicit stamp per email type.
- **No visibility.** There is no record of what was sent, to whom, why, or what was suppressed — auditing meant reading session rows by hand.

## The plan

### 1. Capture the journey properly

Add the missing tracking events so the recap is factual:

- `login` (with device: mobile/desktop) on session start.
- `page_view` on route change inside `/app`.
- One event per initial-questions step: entered, answered, **skipped** (name, agency, phone).
- Onboarding milestones already present stay as-is; add stylesheet install, menu-link rule created, client hub opened, support/AI chat used.

### 2. Build a server-side "state snapshot" instead of trusting events alone

Before writing any email, the function assembles the user's real status from the database: plan, agency name/ID, onboarding completion, login count, first vs returning, last device, install status, which onboarding checklist items are done. The AI writes from that snapshot **plus** the session events — so even a thin session produces an accurate, specific email.

### 3. One send policy, enforced in one place

A single gate decides send/no-send before the AI is ever called:

- Blocklist: `test*`, `*@example.com`, `*@hmail.com`, `+test` addresses, and internal staff addresses.
- First-touch: allowed once per account, ever (explicit stamp).
- Returning: allowed only if no follow-up email in the last 7 days for that account.
- Session must contain real activity, or be a genuine first touch.
- Blank subject/body always suppresses the send (existing guard kept).

### 4. Two purpose-built email shapes

- **Welcome/recapture**: greeting, "here's what you got done", "here's what's still open", one suggestion, closing question + `https://saassuite.ai/success`.
- **Returning**: "since you were last here", stall point, 1-3 next actions, one plan-appropriate "did you know", same closing offer of help.

The AI is instructed to never invent features the user's plan doesn't include (Starter / Basic / Advanced limits), and never claim actions the snapshot doesn't confirm.

### 5. Audit trail

A new `followup_email_log` table records every decision: email, type (welcome/returning), session, subject, body, decision, suppression reason, timestamp. This makes "which sends were good" a one-query answer instead of an investigation, and powers the weekly cap.

### 6. Sweeper cleanup

The idle sweeper keeps closing abandoned sessions, but it now consults the send policy first and skips anything that would be blocked — so it stops generating work that ends in suppression, and stops firing multiple times for the same person.

## Technical notes

- Files: `src/contexts/SessionTrackerContext.tsx` (new events), `src/pages/InitialQuestions.tsx` and `/app` route layer (step + page_view events), `supabase/functions/analyze-user-session/index.ts` (snapshot builder, policy gate, two prompt paths, logging), `supabase/functions/sweep-user-sessions/index.ts` (pre-filter via policy).
- Migration: `followup_email_log` (with GRANTs + RLS, service-role write, admin read) and per-user stamp columns for welcome-sent / last-followup-sent.
- Webhook payload to LeadConnector gains `email_type` (`welcome` | `returning`) so GHL can route the two purposes into different flows.
- No change to the webhook URL.

## Not included

Backfilling or retracting previously sent emails — the earlier audit already listed which ones to pull from GHL manually.
