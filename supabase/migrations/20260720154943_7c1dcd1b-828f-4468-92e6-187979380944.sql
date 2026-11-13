
-- Failsafe: STARTER and BASIC plans must always keep login_enabled = true
-- because guest sessions cannot be created once their tiny user cap is hit.
CREATE OR REPLACE FUNCTION public.enforce_login_required_for_low_plans()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IN ('STARTER', 'BASIC') AND NEW.login_enabled = false THEN
    NEW.login_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_login_required_for_low_plans ON public.saas_suite_users;
CREATE TRIGGER trg_enforce_login_required_for_low_plans
BEFORE INSERT OR UPDATE OF login_enabled, plan ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_login_required_for_low_plans();

-- Restore any STARTER/BASIC account that has login disabled
UPDATE public.saas_suite_users
SET login_enabled = true
WHERE plan IN ('STARTER', 'BASIC') AND login_enabled = false;
