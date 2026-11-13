
UPDATE public.saas_suite_users
SET plan = 'ADVANCED'::public.plan_type, max_onboarding_users = 10000
WHERE lower(email) IN (
  'io@bncinter.io',
  'support@besuite.app',
  'elementizzy@gmail.com',
  'melissa@melissaricker.com'
);

UPDATE public.saas_suite_users
SET plan = 'BASIC'::public.plan_type, max_onboarding_users = 5
WHERE lower(email) IN (
  'richard@maupalife.co.za',
  'gaddi@clientcentrix.io'
);
