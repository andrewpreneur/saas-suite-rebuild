-- Add hide_bonuses column to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN hide_bonuses boolean NOT NULL DEFAULT false;