-- Add trial_length field to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN trial_length integer NOT NULL DEFAULT 7;

-- Update existing users who already have trials to 14 days to honor their original trial
UPDATE public.saas_suite_users 
SET trial_length = 14 
WHERE trial_start_date IS NOT NULL;

-- Update the get_user_trial_info function to use the trial_length field
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
  
  -- Get user info including trial_length
  SELECT ssu.approval, ssu.trial_start_date, ssu.trial_length
  INTO user_record
  FROM saas_suite_users ssu
  WHERE ssu.email = user_email;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return trial info using the user's specific trial_length
  RETURN QUERY
  SELECT 
    user_record.approval,
    user_record.trial_start_date,
    CASE 
      WHEN user_record.approval = 'TRIALING' AND user_record.trial_start_date IS NOT NULL THEN
        GREATEST(0, user_record.trial_length - EXTRACT(DAY FROM (now() - user_record.trial_start_date))::integer)
      ELSE 
        NULL::integer
    END as trial_days_remaining,
    CASE 
      WHEN user_record.approval = 'TRIALING' AND user_record.trial_start_date IS NOT NULL THEN
        (now() - user_record.trial_start_date) >= (user_record.trial_length || ' days')::interval
      ELSE 
        false
    END as is_trial_expired;
END;
$function$;