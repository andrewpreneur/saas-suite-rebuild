-- Drop the existing overly permissive agency lookup policy
DROP POLICY IF EXISTS "Allow public agency lookup for onboarding" ON public.saas_suite_users;

-- Create a secure function for agency lookup that only returns non-sensitive data
CREATE OR REPLACE FUNCTION public.get_agency_info(lookup_agency_id text)
RETURNS TABLE(agency_id text, created_at timestamp with time zone, primary_color text, secondary_color text, tertiary_color text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate input
  IF lookup_agency_id IS NULL OR lookup_agency_id = '' THEN
    RETURN;
  END IF;
  
  -- Return only non-sensitive agency branding data
  RETURN QUERY
  SELECT 
    ssu.agency_id,
    ssu.created_at,
    ssu.primary_color,
    ssu.secondary_color,
    ssu.tertiary_color
  FROM saas_suite_users ssu
  WHERE ssu.agency_id = lookup_agency_id
  LIMIT 1;
END;
$$;