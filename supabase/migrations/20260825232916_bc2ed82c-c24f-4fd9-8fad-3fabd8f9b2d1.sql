CREATE OR REPLACE FUNCTION public.plan_min_onboarding_users(_plan plan_type)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'ADVANCED' THEN 10000
    WHEN 'BASIC' THEN 5
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_plan_onboarding_user_floor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  floor_val integer;
BEGIN
  floor_val := public.plan_min_onboarding_users(COALESCE(NEW.plan, 'STARTER'::plan_type));
  IF NEW.max_onboarding_users IS NULL OR NEW.max_onboarding_users < floor_val THEN
    NEW.max_onboarding_users := floor_val;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_onboarding_user_floor ON public.saas_suite_users;
CREATE TRIGGER trg_enforce_plan_onboarding_user_floor
BEFORE INSERT OR UPDATE OF plan, max_onboarding_users ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_onboarding_user_floor();

UPDATE public.saas_suite_users
SET max_onboarding_users = public.plan_min_onboarding_users(COALESCE(plan, 'STARTER'::plan_type))
WHERE max_onboarding_users IS NULL
   OR max_onboarding_users < public.plan_min_onboarding_users(COALESCE(plan, 'STARTER'::plan_type));