-- Add agency_name column for company/agency name and toggle for using it in URLs
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS agency_name text,
ADD COLUMN IF NOT EXISTS use_agency_name_url boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS original_agency_id text,
ADD COLUMN IF NOT EXISTS original_agency_id_basic text,
ADD COLUMN IF NOT EXISTS original_agency_id_advanced text,
ADD COLUMN IF NOT EXISTS original_agency_id_elite text;

-- Create function to check if agency name is already taken
CREATE OR REPLACE FUNCTION public.check_agency_name_available(name_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate input
  IF name_to_check IS NULL OR name_to_check = '' THEN
    RETURN false;
  END IF;
  
  -- Check if name is used as agency_name or any agency_id
  RETURN NOT EXISTS (
    SELECT 1 FROM saas_suite_users 
    WHERE LOWER(agency_name) = LOWER(name_to_check)
       OR LOWER(agency_id) = LOWER(name_to_check)
       OR LOWER(agency_id_basic) = LOWER(name_to_check)
       OR LOWER(agency_id_advanced) = LOWER(name_to_check)
       OR LOWER(agency_id_elite) = LOWER(name_to_check)
  );
END;
$$;

-- Create function to save agency name and update URLs
CREATE OR REPLACE FUNCTION public.save_agency_name_and_update_urls(user_email text, new_agency_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_basic_id text;
  current_advanced_id text;
  current_elite_id text;
  current_legacy_id text;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' OR new_agency_name IS NULL OR new_agency_name = '' THEN
    RETURN false;
  END IF;
  
  -- Get current agency IDs to store as originals
  SELECT agency_id, agency_id_basic, agency_id_advanced, agency_id_elite
  INTO current_legacy_id, current_basic_id, current_advanced_id, current_elite_id
  FROM saas_suite_users
  WHERE email = user_email;
  
  -- Update with new agency name and store originals if not already stored
  UPDATE saas_suite_users 
  SET agency_name = new_agency_name,
      original_agency_id = COALESCE(original_agency_id, current_legacy_id),
      original_agency_id_basic = COALESCE(original_agency_id_basic, current_basic_id),
      original_agency_id_advanced = COALESCE(original_agency_id_advanced, current_advanced_id),
      original_agency_id_elite = COALESCE(original_agency_id_elite, current_elite_id),
      -- Update actual agency IDs to use agency name
      agency_id = new_agency_name,
      agency_id_basic = new_agency_name,
      agency_id_advanced = CASE WHEN current_advanced_id IS NOT NULL THEN new_agency_name || '-2' ELSE NULL END,
      agency_id_elite = CASE WHEN current_elite_id IS NOT NULL THEN new_agency_name || '-3' ELSE NULL END,
      use_agency_name_url = true
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;

-- Create function to toggle between agency name URLs and original URLs
CREATE OR REPLACE FUNCTION public.toggle_agency_name_url(user_email text, use_name_url boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_agency_name text;
  orig_basic text;
  orig_advanced text;
  orig_elite text;
  orig_legacy text;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Get agency name and original IDs
  SELECT agency_name, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite
  INTO user_agency_name, orig_legacy, orig_basic, orig_advanced, orig_elite
  FROM saas_suite_users
  WHERE email = user_email;
  
  IF use_name_url THEN
    -- Switch to agency name URLs
    IF user_agency_name IS NULL OR user_agency_name = '' THEN
      RETURN false; -- No agency name set
    END IF;
    
    UPDATE saas_suite_users 
    SET use_agency_name_url = true,
        agency_id = user_agency_name,
        agency_id_basic = user_agency_name,
        agency_id_advanced = CASE WHEN orig_advanced IS NOT NULL THEN user_agency_name || '-2' ELSE NULL END,
        agency_id_elite = CASE WHEN orig_elite IS NOT NULL THEN user_agency_name || '-3' ELSE NULL END
    WHERE email = user_email;
  ELSE
    -- Switch back to original URLs
    UPDATE saas_suite_users 
    SET use_agency_name_url = false,
        agency_id = orig_legacy,
        agency_id_basic = orig_basic,
        agency_id_advanced = orig_advanced,
        agency_id_elite = orig_elite
    WHERE email = user_email;
  END IF;
  
  RETURN true;
END;
$$;