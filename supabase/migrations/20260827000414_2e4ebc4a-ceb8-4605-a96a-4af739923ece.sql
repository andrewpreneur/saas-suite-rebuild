ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'null';
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'NULL';
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'Null';
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS '';

CREATE OR REPLACE FUNCTION public.normalize_null_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS NULL OR NEW.plan::text IN ('null', 'NULL', 'Null', '') THEN
    NEW.plan := 'STARTER';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_null_plan ON public.saas_suite_users;
CREATE TRIGGER trg_normalize_null_plan
BEFORE INSERT OR UPDATE OF plan ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.normalize_null_plan();