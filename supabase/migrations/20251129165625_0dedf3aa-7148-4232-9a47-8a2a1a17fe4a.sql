-- Create function to suspend user access (append NO to agency IDs)
CREATE OR REPLACE FUNCTION public.suspend_user_access(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Set approval to NO and append 'NO' to all agency IDs
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
  
  RETURN FOUND;
END;
$$;

-- Create function to restore user access (remove NO suffix from agency IDs)
CREATE OR REPLACE FUNCTION public.restore_user_access(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Set approval to YES and remove 'NO' suffix from all agency IDs
  UPDATE saas_suite_users 
  SET approval = 'YES',
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