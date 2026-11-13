UPDATE public.saas_suite_users
SET plan = 'ADVANCED'::public.plan_type, max_onboarding_users = 10000
WHERE lower(email) IN (
  'thor.goldsmith@gmail.com',
  'hello@lauradistelrath.com',
  'systlybiz@gmail.com',
  'ben@mysterious.inc',
  'calum@optimiseonline.com.au',
  'codexositeswp@outlook.com'
);