ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS onboarding_intent text,
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_reminder_dismissed boolean NOT NULL DEFAULT false;