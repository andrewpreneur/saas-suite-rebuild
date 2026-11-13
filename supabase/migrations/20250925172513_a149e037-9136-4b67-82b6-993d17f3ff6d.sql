-- Add onboarding question fields to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN highlevel_experience text,
ADD COLUMN active_subaccounts text,
ADD COLUMN most_used_feature text;

-- Migrate existing data from user_onboarding_responses to saas_suite_users
UPDATE public.saas_suite_users 
SET 
  highlevel_experience = uor.highlevel_experience,
  active_subaccounts = uor.active_subaccounts,
  most_used_feature = uor.most_used_feature
FROM public.user_onboarding_responses uor
INNER JOIN auth.users au ON uor.user_id = au.id
WHERE public.saas_suite_users.email = au.email;