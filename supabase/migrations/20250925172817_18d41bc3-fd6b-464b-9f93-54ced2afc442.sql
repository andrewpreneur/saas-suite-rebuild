-- Add name field to saas_suite_users table  
ALTER TABLE public.saas_suite_users 
ADD COLUMN full_name text;