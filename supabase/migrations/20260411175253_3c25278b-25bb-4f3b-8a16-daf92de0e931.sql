UPDATE public.saas_suite_users
SET plan = 'ADVANCED'::public.plan_type,
    max_onboarding_users = 10000,
    free_leads_access = true,
    email_warmup_access = true
WHERE lower(email) = 'jamesrwatsonx@gmail.com';