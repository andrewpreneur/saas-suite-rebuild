-- Add source column to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN source text DEFAULT 'Unknown';