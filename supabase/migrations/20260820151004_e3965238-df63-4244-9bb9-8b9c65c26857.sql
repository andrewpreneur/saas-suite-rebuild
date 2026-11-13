REVOKE ALL ON FUNCTION public.reconcile_missing_starter_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_missing_starter_users() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_auth_user_starter() FROM PUBLIC, anon, authenticated;