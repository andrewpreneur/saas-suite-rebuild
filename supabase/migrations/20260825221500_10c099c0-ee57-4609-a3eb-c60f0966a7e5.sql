REVOKE EXECUTE ON FUNCTION public.mark_payment_delinquent(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_delinquent(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.clear_payment_delinquency(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_payment_delinquency(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.suspend_user_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_user_access(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_user_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_user_access(text) TO service_role;