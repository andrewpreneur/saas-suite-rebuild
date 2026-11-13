ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS cancel_access_until timestamptz;

CREATE OR REPLACE FUNCTION public.expired_cancel_access_users()
RETURNS TABLE(email text, cancel_access_until timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT email, cancel_access_until FROM saas_suite_users
  WHERE cancel_access_until IS NOT NULL AND cancel_access_until < now()
    AND COALESCE(billing_state, 'ACTIVE') <> 'PAST_DUE';
$$;
REVOKE EXECUTE ON FUNCTION public.expired_cancel_access_users() FROM anon, authenticated;

SELECT public.clear_payment_delinquency('cate@sanesocialmedia.com', 'ADVANCED');
UPDATE public.saas_suite_users SET cancel_access_until = '2026-10-17T23:59:59-05:00'
WHERE lower(email) = 'cate@sanesocialmedia.com';