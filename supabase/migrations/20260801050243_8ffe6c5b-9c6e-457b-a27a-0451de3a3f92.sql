UPDATE public.saas_suite_users
SET plan = 'ADVANCED',
    max_onboarding_users = 10000,
    approval = 'YES',
    agency_id_advanced = COALESCE(agency_id_advanced, agency_id, agency_id_basic)
WHERE email ILIKE 'byjennypark@gmail.com';