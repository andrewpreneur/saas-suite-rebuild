-- Fix: visionaryaisolutionsinc@gmail.com is on BASIC but max_onboarding_users
-- was stuck at 1 (Starter limit). Bump to 5 per Basic plan policy.
UPDATE public.saas_suite_users
SET max_onboarding_users = 5
WHERE email = 'visionaryaisolutionsinc@gmail.com'
  AND plan = 'BASIC'
  AND COALESCE(max_onboarding_users, 0) < 5;
