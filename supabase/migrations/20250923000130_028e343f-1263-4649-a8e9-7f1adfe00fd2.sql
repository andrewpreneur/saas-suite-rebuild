-- Update trial length from 14 days to 7 days in the database function
CREATE OR REPLACE FUNCTION public.get_user_trial_info(user_email text)
RETURNS TABLE(approval text, trial_start_date timestamp with time zone, trial_days_remaining integer, is_trial_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_record record;
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Get user info
  SELECT ssu.approval, ssu.trial_start_date
  INTO user_record
  FROM saas_suite_users ssu
  WHERE ssu.email = user_email;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return trial info (changed from 14 days to 7 days)
  RETURN QUERY
  SELECT 
    user_record.approval,
    user_record.trial_start_date,
    CASE 
      WHEN user_record.approval = 'TRIALING' AND user_record.trial_start_date IS NOT NULL THEN
        GREATEST(0, 7 - EXTRACT(DAY FROM (now() - user_record.trial_start_date))::integer)
      ELSE 
        NULL::integer
    END as trial_days_remaining,
    CASE 
      WHEN user_record.approval = 'TRIALING' AND user_record.trial_start_date IS NOT NULL THEN
        (now() - user_record.trial_start_date) >= interval '7 days'
      ELSE 
        false
    END as is_trial_expired;
END;
$function$;