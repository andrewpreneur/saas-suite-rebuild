
-- Add onboarding deployment configuration columns to saas_suite_users
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS onboarding_deployment_mode text NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS onboarding_deployment_plans text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS onboarding_deployment_users text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS onboarding_deployment_configured boolean NOT NULL DEFAULT false;

-- Constrain mode to known values via trigger (avoid CHECK lock-ins)
CREATE OR REPLACE FUNCTION public.validate_onboarding_deployment_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_deployment_mode IS NULL OR NEW.onboarding_deployment_mode NOT IN ('ALL','PLANS','USERS') THEN
    NEW.onboarding_deployment_mode := 'ALL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_onboarding_deployment_mode_trg ON public.saas_suite_users;
CREATE TRIGGER validate_onboarding_deployment_mode_trg
BEFORE INSERT OR UPDATE OF onboarding_deployment_mode ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.validate_onboarding_deployment_mode();
