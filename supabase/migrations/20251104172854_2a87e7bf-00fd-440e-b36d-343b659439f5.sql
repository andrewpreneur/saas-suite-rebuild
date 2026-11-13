-- Add email_warmup_access column to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN email_warmup_access boolean NOT NULL DEFAULT false;

-- Set all existing users to false (no access)
UPDATE public.saas_suite_users 
SET email_warmup_access = false;