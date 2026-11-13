ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS last_onboarding_session_id TEXT;