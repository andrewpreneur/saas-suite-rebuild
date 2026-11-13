
CREATE OR REPLACE FUNCTION public.auto_enable_onboarding_for_advanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan = 'ADVANCED' THEN
    NEW.onboarding_call_access := true;
    IF COALESCE(NEW.onboarding_call_wallet, 0) < 1 THEN
      NEW.onboarding_call_wallet := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enable_onboarding_for_advanced ON public.saas_suite_users;
CREATE TRIGGER trg_auto_enable_onboarding_for_advanced
BEFORE INSERT OR UPDATE OF plan ON public.saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION public.auto_enable_onboarding_for_advanced();

DROP FUNCTION IF EXISTS public.consume_onboarding_call(text, int);

CREATE OR REPLACE FUNCTION public.consume_onboarding_call(_email text, _amount int DEFAULT 1)
RETURNS TABLE(new_wallet int, access_enabled bool)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_wallet int;
  v_access bool;
BEGIN
  UPDATE public.saas_suite_users
  SET onboarding_call_wallet = GREATEST(COALESCE(onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0),
      onboarding_call_access = CASE
        WHEN plan = 'ADVANCED' THEN true
        WHEN GREATEST(COALESCE(onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0) = 0 THEN false
        ELSE onboarding_call_access
      END
  WHERE lower(email) = lower(_email)
  RETURNING onboarding_call_wallet, onboarding_call_access
  INTO v_new_wallet, v_access;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;

  RETURN QUERY SELECT v_new_wallet, v_access;
END;
$$;

UPDATE public.saas_suite_users
SET onboarding_call_access = true,
    onboarding_call_wallet = GREATEST(COALESCE(onboarding_call_wallet, 0), 1)
WHERE plan = 'ADVANCED';
