UPDATE public.saas_suite_users
SET trial_start_date = COALESCE(trial_start_date, created_at),
    trial_length = 14
WHERE email = 'jayna90@gmail.com';