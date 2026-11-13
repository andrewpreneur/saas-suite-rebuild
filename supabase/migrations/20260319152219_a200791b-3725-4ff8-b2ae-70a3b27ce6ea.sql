
-- Fix restore_user_access to also update plan and max_onboarding_users
CREATE OR REPLACE FUNCTION public.restore_user_access(user_email text, user_plan text DEFAULT 'ADVANCED')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Set approval to YES, update plan, set appropriate user limits, and remove 'NO' suffix from all agency IDs
  UPDATE saas_suite_users 
  SET approval = 'YES',
      plan = CASE 
        WHEN upper(user_plan) = 'BASIC' THEN 'BASIC'::plan_type
        WHEN upper(user_plan) = 'STARTER' THEN 'STARTER'::plan_type
        ELSE 'ADVANCED'::plan_type
      END,
      max_onboarding_users = CASE 
        WHEN upper(user_plan) = 'STARTER' THEN 1
        WHEN upper(user_plan) = 'BASIC' THEN 5
        ELSE NULL  -- ADVANCED = unlimited
      END,
      agency_id = CASE 
        WHEN agency_id LIKE '%NO' 
        THEN SUBSTRING(agency_id, 1, LENGTH(agency_id) - 2) 
        ELSE agency_id 
      END,
      agency_id_basic = CASE 
        WHEN agency_id_basic LIKE '%NO' 
        THEN SUBSTRING(agency_id_basic, 1, LENGTH(agency_id_basic) - 2) 
        ELSE agency_id_basic 
      END,
      agency_id_advanced = CASE 
        WHEN agency_id_advanced LIKE '%NO' 
        THEN SUBSTRING(agency_id_advanced, 1, LENGTH(agency_id_advanced) - 2) 
        ELSE agency_id_advanced 
      END,
      agency_id_elite = CASE 
        WHEN agency_id_elite LIKE '%NO' 
        THEN SUBSTRING(agency_id_elite, 1, LENGTH(agency_id_elite) - 2) 
        ELSE agency_id_elite 
      END,
      last_accessed = now()
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;
