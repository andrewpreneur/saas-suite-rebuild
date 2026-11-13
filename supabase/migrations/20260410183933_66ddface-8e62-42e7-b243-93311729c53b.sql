UPDATE public.saas_suite_users
SET plan = 'BASIC'::public.plan_type,
    max_onboarding_users = 5
WHERE lower(email) = 'bgtcreativellc@gmail.com';