
CREATE OR REPLACE FUNCTION public.auto_enable_onboarding_for_advanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan = 'ADVANCED' THEN
    NEW.onboarding_call_access := true;
    -- Do NOT touch wallet; it only changes via purchases / consumption
  END IF;
  RETURN NEW;
END;
$$;

-- Reset wallets we artificially bumped to 1 in the previous backfill
UPDATE public.saas_suite_users
SET onboarding_call_wallet = 0
WHERE plan = 'ADVANCED' AND onboarding_call_wallet = 1;

-- Ensure all advanced users have access on
UPDATE public.saas_suite_users
SET onboarding_call_access = true
WHERE plan = 'ADVANCED' AND onboarding_call_access IS DISTINCT FROM true;
