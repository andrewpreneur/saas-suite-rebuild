-- Add additional agency ID columns for multiple onboarding versions
ALTER TABLE public.saas_suite_users 
ADD COLUMN agency_id_basic text,
ADD COLUMN agency_id_advanced text,  
ADD COLUMN agency_id_elite text;

-- Update existing agency_id data to agency_id_basic for backward compatibility
UPDATE public.saas_suite_users 
SET agency_id_basic = agency_id 
WHERE agency_id IS NOT NULL;

-- Create function to generate and save multiple agency IDs
CREATE OR REPLACE FUNCTION public.create_agency_version_safe(
  user_email text, 
  version_type text
) 
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_agency_id text;
  column_name text;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;
  
  IF version_type NOT IN ('basic', 'advanced', 'elite') THEN
    RAISE EXCEPTION 'Version type must be basic, advanced, or elite';
  END IF;
  
  -- Generate unique agency ID
  new_agency_id := REPLACE(gen_random_uuid()::text, '-', '');
  
  -- Determine column name based on version type
  column_name := 'agency_id_' || version_type;
  
  -- Update the appropriate column using dynamic SQL
  EXECUTE format('UPDATE public.saas_suite_users SET %I = $1 WHERE email = $2', column_name)
  USING new_agency_id, user_email;
  
  RETURN new_agency_id;
END;
$$;

-- Create function to get all agency versions for a user
CREATE OR REPLACE FUNCTION public.get_user_agency_versions(user_email text)
RETURNS TABLE(
  basic_id text,
  advanced_id text, 
  elite_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate input
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Return agency IDs for all versions
  RETURN QUERY
  SELECT 
    u.agency_id_basic,
    u.agency_id_advanced,
    u.agency_id_elite
  FROM saas_suite_users u
  WHERE u.email = user_email;
END;
$$;