ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS premium_support boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_support_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_saas_suite_users_premium_support
  ON public.saas_suite_users (premium_support)
  WHERE premium_support;