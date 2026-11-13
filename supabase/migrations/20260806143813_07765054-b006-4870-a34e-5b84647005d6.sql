UPDATE public.saas_suite_users
SET onboarding_skipped = false, onboarding_skipped_at = NULL
WHERE onboarding_skipped = true AND onboarding_completed = true;