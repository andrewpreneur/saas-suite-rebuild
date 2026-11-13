-- Add v2_navigation_enabled column to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS v2_navigation_enabled boolean NOT NULL DEFAULT false;