-- Optional extra protection for subscription_canceled claims.
-- Correctness does not depend on this index. claim_subscription_canceled_message
-- takes an advisory lock and inserts only when no matching row exists.
-- provider_message_id is "<subscription id>:<period end or cancel_at ISO>:<kind>".
--
-- This file is only the index, and it has no BEGIN/COMMIT wrapper.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- The Supabase CLI wraps every migration file in a transaction, and this
-- repository has no switch that turns that wrapper off, so `supabase db push`
-- cannot apply this statement. Apply it in a session that is not inside a
-- transaction, after 20261024181245_subscription_canceled_dedupe.sql:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/20261024181246_subscription_canceled_dedupe_index.sql
--
-- Not applied from the agent. Do not run it against production from CI.
-- PGlite cannot build an index CONCURRENTLY; tests strip that keyword.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS customer_message_events_subscription_canceled_key
  ON public.customer_message_events (provider_message_id)
  WHERE template_key = 'subscription_canceled'
    AND provider_message_id IS NOT NULL;
