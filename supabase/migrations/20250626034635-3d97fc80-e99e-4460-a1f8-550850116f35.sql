
-- Add last_accessed column to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN last_accessed timestamp with time zone DEFAULT now();
