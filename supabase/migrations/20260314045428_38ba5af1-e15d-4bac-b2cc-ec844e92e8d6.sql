CREATE OR REPLACE FUNCTION public.suspend_user_access(user_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id text;
  v_original_agency_id text;
  v_user_count integer;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;

  -- Get the user's current agency_id and original_agency_id
  SELECT agency_id, original_agency_id
    INTO v_agency_id, v_original_agency_id
    FROM saas_suite_users
   WHERE email = user_email;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Determine the clean agency_id (without NO suffix) to count users
  DECLARE
    v_clean_agency_id text;
  BEGIN
    v_clean_agency_id := COALESCE(v_original_agency_id, v_agency_id);
    -- Strip trailing NO if present
    IF v_clean_agency_id IS NOT NULL AND v_clean_agency_id LIKE '%NO' THEN
      v_clean_agency_id := left(v_clean_agency_id, length(v_clean_agency_id) - 2);
    END IF;

    -- Count distinct onboarding users for this agency
    SELECT count(DISTINCT id)
      INTO v_user_count
      FROM user_progress
     WHERE agency_id = v_clean_agency_id;
  END;

  IF v_user_count > 1 THEN
    -- More than 1 user: full suspension (existing NO flow)
    UPDATE saas_suite_users 
    SET approval = 'NO',
        agency_id = CASE 
          WHEN agency_id IS NOT NULL AND NOT agency_id LIKE '%NO' 
          THEN agency_id || 'NO' 
          ELSE agency_id 
        END,
        agency_id_basic = CASE 
          WHEN agency_id_basic IS NOT NULL AND NOT agency_id_basic LIKE '%NO' 
          THEN agency_id_basic || 'NO' 
          ELSE agency_id_basic 
        END,
        agency_id_advanced = CASE 
          WHEN agency_id_advanced IS NOT NULL AND NOT agency_id_advanced LIKE '%NO' 
          THEN agency_id_advanced || 'NO' 
          ELSE agency_id_advanced 
        END,
        agency_id_elite = CASE 
          WHEN agency_id_elite IS NOT NULL AND NOT agency_id_elite LIKE '%NO' 
          THEN agency_id_elite || 'NO' 
          ELSE agency_id_elite 
        END,
        last_accessed = now()
    WHERE email = user_email;
  ELSE
    -- 1 or fewer users: downgrade to STARTER (keep access, limit features)
    UPDATE saas_suite_users
    SET approval = 'STARTER',
        plan = 'STARTER',
        max_onboarding_users = 1,
        last_accessed = now()
    WHERE email = user_email;
  END IF;

  RETURN FOUND;
END;
$function$;