-- Fix get_agency_user_limit to count unique users with emails, not duplicate guest entries
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
    (SELECT COUNT(DISTINCT up.id) 
     FROM user_progress up 
     WHERE up.agency_id = p_agency_id
       AND up.email IS NOT NULL
       AND up.email != ''
    ) AS current_users
  FROM saas_suite_users ssu
  WHERE ssu.agency_id = p_agency_id
     OR ssu.agency_id_basic = p_agency_id
     OR ssu.agency_id_advanced = p_agency_id
     OR ssu.agency_id_elite = p_agency_id
  LIMIT 1;
END;
$$;

-- Fix create_guest_user to reuse recent guests instead of creating duplicates on refresh
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
BEGIN
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