-- Create function to update user onboarding step
CREATE OR REPLACE FUNCTION public.update_user_onboarding(user_email text, step integer, completed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Update onboarding progress for the user
  UPDATE saas_suite_users 
  SET onboarding_step = step, 
      onboarding_completed = completed,
      last_accessed = now()
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$function$;

-- Create function to update user colors and complete onboarding
CREATE OR REPLACE FUNCTION public.update_user_colors_and_complete(
  user_email text, 
  primary_color text DEFAULT NULL, 
  secondary_color text DEFAULT NULL, 
  tertiary_color text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Update colors and complete onboarding for the user
  UPDATE saas_suite_users 
  SET primary_color = update_user_colors_and_complete.primary_color,
      secondary_color = update_user_colors_and_complete.secondary_color,
      tertiary_color = update_user_colors_and_complete.tertiary_color,
      onboarding_step = 0,
      onboarding_completed = true,
      last_accessed = now()
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$function$;