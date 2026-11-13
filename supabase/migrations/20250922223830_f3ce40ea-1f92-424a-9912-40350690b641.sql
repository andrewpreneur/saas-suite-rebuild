-- Remove failing trigger and function that depend on pg_net
DROP TRIGGER IF EXISTS onboarding_completed_trigger ON saas_suite_users;
DROP FUNCTION IF EXISTS notify_onboarding_completed();