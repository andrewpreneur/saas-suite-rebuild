-- Update defaults for v2_navigation_enabled and client_hub_enabled for new users
-- These changes only affect new rows, existing users will keep their current values

ALTER TABLE public.saas_suite_users 
ALTER COLUMN v2_navigation_enabled SET DEFAULT true;

ALTER TABLE public.saas_suite_users 
ALTER COLUMN client_hub_enabled SET DEFAULT true;