ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS fbclid TEXT;
CREATE INDEX IF NOT EXISTS idx_saas_suite_users_fbclid ON public.saas_suite_users (fbclid) WHERE fbclid IS NOT NULL;