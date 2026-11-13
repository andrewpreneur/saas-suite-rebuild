-- QA visits (?ss_test=1) are stored and kept out of ad reports.
-- Additive only: existing rows stay false via the column default. No data rewrite.

ALTER TABLE public.site_analytics_events
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.one_feature_training_leads
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_analytics_events.is_test IS
  'True when the browser was marked with ?ss_test=1. Not used for ad optimization.';

COMMENT ON COLUMN public.one_feature_training_leads.is_test IS
  'True when the training form was submitted from a ?ss_test=1 browser.';

COMMENT ON COLUMN public.checkout_sessions.is_test IS
  'True when checkout was started from a ?ss_test=1 browser.';
