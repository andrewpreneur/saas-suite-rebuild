-- Update the get_user_by_email function to include new columns
CREATE OR REPLACE FUNCTION public.get_user_by_email(user_email text)
RETURNS TABLE(
  id bigint, 
  created_at timestamp with time zone, 
  email text, 
  approval text, 
  last_accessed timestamp with time zone,
  agency_id text,
  onboarding_completed boolean,
  onboarding_step integer,
  primary_color text,
  secondary_color text,
  tertiary_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Add basic validation
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Return all user data including new columns
  RETURN QUERY
  SELECT 
    u.id, 
    u.created_at, 
    u.email, 
    u.approval, 
    u.last_accessed,
    u.agency_id,
    u.onboarding_completed,
    u.onboarding_step,
    u.primary_color,
    u.secondary_color,
    u.tertiary_color
  FROM saas_suite_users u
  WHERE u.email = user_email;
END;
$function$;