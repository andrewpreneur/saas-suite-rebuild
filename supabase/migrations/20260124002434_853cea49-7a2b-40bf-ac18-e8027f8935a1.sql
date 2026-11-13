-- Add webhook URL column for support ticketing
ALTER TABLE public.saas_suite_users
ADD COLUMN IF NOT EXISTS support_webhook_url text;