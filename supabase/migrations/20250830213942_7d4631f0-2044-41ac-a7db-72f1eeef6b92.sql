-- Add onboarding completion tracking to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN onboarding_completed boolean DEFAULT false,
ADD COLUMN onboarding_step integer DEFAULT 0;