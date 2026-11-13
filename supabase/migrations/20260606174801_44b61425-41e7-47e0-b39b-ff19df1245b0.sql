
-- Atomically add N onboarding calls to a user's wallet and ensure access is on.
CREATE OR REPLACE FUNCTION public.add_onboarding_calls(_email text, _amount integer)
RETURNS TABLE (email text, onboarding_call_wallet integer, onboarding_call_access boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text := lower(trim(_email));
  _amt integer := GREATEST(COALESCE(_amount, 1), 1);
BEGIN
  UPDATE public.saas_suite_users s
     SET onboarding_call_wallet = COALESCE(s.onboarding_call_wallet, 0) + _amt,
         onboarding_call_access = true
   WHERE lower(s.email) = _normalized;

  RETURN QUERY
  SELECT s.email, s.onboarding_call_wallet, s.onboarding_call_access
    FROM public.saas_suite_users s
   WHERE lower(s.email) = _normalized;
END;
$$;

-- Atomically decrement (default 1) the wallet. Will not go below 0.
-- When the wallet reaches 0, access is turned off automatically.
CREATE OR REPLACE FUNCTION public.consume_onboarding_call(_email text, _amount integer DEFAULT 1)
RETURNS TABLE (email text, onboarding_call_wallet integer, onboarding_call_access boolean, success boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text := lower(trim(_email));
  _amt integer := GREATEST(COALESCE(_amount, 1), 1);
  _current integer;
  _new integer;
BEGIN
  SELECT s.onboarding_call_wallet INTO _current
    FROM public.saas_suite_users s
   WHERE lower(s.email) = _normalized
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT _normalized, 0, false, false;
    RETURN;
  END IF;

  _new := GREATEST(COALESCE(_current, 0) - _amt, 0);

  UPDATE public.saas_suite_users s
     SET onboarding_call_wallet = _new,
         onboarding_call_access = CASE WHEN _new <= 0 THEN false ELSE s.onboarding_call_access END
   WHERE lower(s.email) = _normalized;

  RETURN QUERY
  SELECT s.email, s.onboarding_call_wallet, s.onboarding_call_access, true
    FROM public.saas_suite_users s
   WHERE lower(s.email) = _normalized;
END;
$$;

REVOKE ALL ON FUNCTION public.add_onboarding_calls(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_onboarding_call(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_onboarding_calls(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_onboarding_call(text, integer) TO service_role;
