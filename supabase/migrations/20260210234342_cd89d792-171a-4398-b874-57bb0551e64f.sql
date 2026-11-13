
-- 1. Add STARTER to plan_type enum
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'STARTER';

-- 2. Add max_onboarding_users column
ALTER TABLE public.saas_suite_users
ADD COLUMN IF NOT EXISTS max_onboarding_users integer;

-- 3. Bulk update: enable v2 navigation and client hub for all existing users
UPDATE public.saas_suite_users
SET v2_navigation_enabled = true, client_hub_enabled = true
WHERE v2_navigation_enabled = false OR client_hub_enabled = false;

-- 4. Create get_agency_user_limit RPC
CREATE OR REPLACE FUNCTION public.get_agency_user_limit(p_agency_id text)
RETURNS TABLE(max_users integer, current_users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ssu.max_onboarding_users AS max_users,
    (SELECT COUNT(DISTINCT up.id) FROM user_progress up WHERE up.agency_id = p_agency_id) AS current_users
  FROM saas_suite_users ssu
  WHERE ssu.agency_id = p_agency_id
     OR ssu.agency_id_basic = p_agency_id
     OR ssu.agency_id_advanced = p_agency_id
     OR ssu.agency_id_elite = p_agency_id
  LIMIT 1;
END;
$$;
