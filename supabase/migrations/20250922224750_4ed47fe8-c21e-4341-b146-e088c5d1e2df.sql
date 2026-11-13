-- Remove the trigger and function that was just created
DROP TRIGGER IF EXISTS onboarding_completed_edge_trigger ON saas_suite_users;
DROP FUNCTION IF EXISTS public.notify_onboarding_completed_edge();