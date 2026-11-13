ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS hub_welcome_email_sent_at timestamptz;