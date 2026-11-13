-- Customer timeline
-- Run in the Supabase SQL editor (postgres). customer_timeline is granted to
-- service_role only, so anon and authenticated clients cannot call it.
--
-- Replace the email with the customer you want. This example is the account
-- from the Oct 21, 2026 audit.

SELECT *
FROM public.customer_timeline('admin@digitalaspect.io');

-- Columns: occurred_at, source, event_type, status, title, detail, email.
-- Rows are newest-or-oldest chronological (occurred_at ascending, nulls last).
--
-- Sources merged into one list:
--   customer_message_events   emails, SMS, and webhooks that trigger a message,
--                             including ones that were suppressed or failed
--   checkout_sessions         Stripe Checkout, including open / completed / expired.
--                             An open session older than 24 hours is reported
--                             as abandoned. Stripe's checkout.session.expired
--                             event is stored as expired. There is no cron that
--                             rewrites open rows.
--   plan_change_history       plan and billing_state changes after this migration
--   login_events              counted sign-ins (app calls and the auth-audit backfill)
--   site_analytics_events     page analytics already in the database
--   webinar_registrations     webinar signups
--   followup_email_log        older follow-up decisions (sent vs suppressed)
--   support_tickets           tickets opened by or for this email
--   support_ticket_replies    replies on those tickets
--   ai_chat_messages          chat rows stored under user_identifier
--   copilot_chat_messages     Copilot rows stored under owner_email
--   kit_purchases             One Feature Kit purchases
--   kit_events                kit events joined by checkout session email
--   one_feature_training_leads  training opt-ins
--
-- Follow-up, not part of this query's job:
-- send-activation-rescue exists as an edge function and is set verify_jwt = false,
-- but nothing in the repo calls it and no cron job is defined for it, so it has
-- never sent. It is intentionally not scheduled here. Turning it on would start
-- sending email.
