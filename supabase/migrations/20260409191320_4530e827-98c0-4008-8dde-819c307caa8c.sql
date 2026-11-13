
-- Fix BASIC users with wrong max_onboarding_users (should be 5)
-- Exclude dan@quantumcollective.com who is grandfathered with unlimited
UPDATE saas_suite_users 
SET max_onboarding_users = 5 
WHERE plan = 'BASIC' 
  AND (max_onboarding_users IS NULL OR max_onboarding_users != 5)
  AND email != 'dan@quantumcollective.com';

-- Update create_guest_user to enforce user limits
CREATE OR REPLACE FUNCTION public.create_guest_user(p_agency_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_number integer;
  v_guest_name text;
  v_user_id uuid;
  v_existing_guest text;
  v_limit_data record;
BEGIN
  -- Check user limit before creating a new guest
  SELECT current_users, max_users INTO v_limit_data
  FROM get_agency_user_limit(p_agency_id)
  LIMIT 1;
  
  -- Reuse existing guest session within 2 hours (doesn't count as new user)
  SELECT up.name INTO v_existing_guest
  FROM user_progress up
  WHERE up.agency_id = p_agency_id
    AND up.name LIKE 'Guest User #%'
    AND up.created_at > now() - interval '2 hours'
  ORDER BY up.created_at DESC
  LIMIT 1;
  
  IF v_existing_guest IS NOT NULL THEN
    UPDATE user_progress 
    SET last_accessed = now()
    WHERE agency_id = p_agency_id AND name = v_existing_guest;
    RETURN v_existing_guest;
  END IF;

  -- If no reusable session, enforce limit for new users
  IF v_limit_data IS NOT NULL AND v_limit_data.max_users IS NOT NULL 
     AND v_limit_data.current_users >= v_limit_data.max_users THEN
    RETURN NULL;
  END IF;

  INSERT INTO agency_guest_counter (agency_id, guest_count)
  VALUES (p_agency_id, 1)
  ON CONFLICT (agency_id) 
  DO UPDATE SET 
    guest_count = agency_guest_counter.guest_count + 1,
    updated_at = now()
  RETURNING guest_count INTO v_guest_number;
  
  v_guest_name := 'Guest User #' || v_guest_number;
  
  INSERT INTO user_progress (name, agency_id, approval)
  VALUES (v_guest_name, p_agency_id, 'APPROVED')
  RETURNING id INTO v_user_id;
  
  RETURN v_guest_name;
END;
$$;

-- Create a simple capacity check RPC for the other platform
CREATE OR REPLACE FUNCTION public.check_agency_at_capacity(p_agency_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_data record;
BEGIN
  SELECT current_users, max_users INTO v_limit_data
  FROM get_agency_user_limit(p_agency_id)
  LIMIT 1;
  
  IF v_limit_data IS NULL OR v_limit_data.max_users IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_limit_data.current_users >= v_limit_data.max_users;
END;
$$;
