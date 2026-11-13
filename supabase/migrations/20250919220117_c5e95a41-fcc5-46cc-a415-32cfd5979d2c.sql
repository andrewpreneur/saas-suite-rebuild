-- Update the start_user_trial function to preserve existing "YES" approval status
CREATE OR REPLACE FUNCTION public.start_user_trial(user_email text, user_affiliate_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_approval text;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Check if user exists and get their current approval status
  SELECT approval INTO current_approval 
  FROM saas_suite_users 
  WHERE email = user_email;
  
  IF current_approval IS NOT NULL THEN
    -- User exists - only update if they don't already have "YES" approval
    IF current_approval = 'YES' THEN
      -- User already has full access, don't change their status
      UPDATE saas_suite_users 
      SET last_accessed = now(),
          affiliate_id = COALESCE(user_affiliate_id, affiliate_id)
      WHERE email = user_email;
      RETURN true;
    ELSE
      -- User exists but doesn't have "YES" approval, update to trialing
      UPDATE saas_suite_users 
      SET approval = 'TRIALING',
          trial_start_date = CASE 
            WHEN trial_start_date IS NULL THEN now()
            ELSE trial_start_date
          END,
          affiliate_id = COALESCE(user_affiliate_id, affiliate_id),
          last_accessed = now()
      WHERE email = user_email;
      RETURN true;
    END IF;
  ELSE
    -- New user - create with trialing status
    INSERT INTO saas_suite_users (email, approval, trial_start_date, affiliate_id, created_at)
    VALUES (user_email, 'TRIALING', now(), user_affiliate_id, now());
    RETURN true;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$