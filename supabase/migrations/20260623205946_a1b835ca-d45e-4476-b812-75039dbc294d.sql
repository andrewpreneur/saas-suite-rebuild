
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS custom_domain_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_live BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_went_live_at TIMESTAMPTZ;
