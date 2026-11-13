-- Add trial_start_date column to track when users start their trial
ALTER TABLE public.saas_suite_users 
ADD COLUMN trial_start_date timestamp with time zone DEFAULT NULL;

-- Create function to calculate trial days remaining
CREATE OR REPLACE FUNCTION public.get_user_trial_info(user_email text)
RETURNS TABLE(
  approval text,
  trial_start_date timestamp with time zone,
  trial_days_remaining integer,
  is_trial_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  
  -- Return trial info
  RETURN QUERY
  SELECT 
    user_record.approval,
    user_record.trial_start_date,
    CASE 
      WHEN user_record.approval = 'TRIALING' AND user_record.trial_start_date IS NOT NULL THEN
        GREATEST(0, 14 - EXTRACT(DAY FROM (now() - user_record.trial_start_date))::integer)
      ELSE 
        NULL::integer
    END as trial_days_remaining,
    CASE 
      WHEN user_record.approval = 'TRIALING' AND user_record.trial_start_date IS NOT NULL THEN
        (now() - user_record.trial_start_date) >= interval '14 days'
      ELSE 
        false
    END as is_trial_expired;
END;
$function$;

-- Create function to start a user's trial
CREATE OR REPLACE FUNCTION public.start_user_trial(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Update or insert user with trial status
  INSERT INTO saas_suite_users (email, approval, trial_start_date, created_at)
  VALUES (user_email, 'TRIALING', now(), now())
  ON CONFLICT (email)
  DO UPDATE SET 
    approval = 'TRIALING',
    trial_start_date = CASE 
      WHEN saas_suite_users.trial_start_date IS NULL THEN now()
      ELSE saas_suite_users.trial_start_date
    END,
    last_accessed = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;

-- Create function to cancel user access and clear agency IDs
CREATE OR REPLACE FUNCTION public.cancel_user_access(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Set approval to NO and clear all agency IDs
  UPDATE saas_suite_users 
  SET approval = 'NO',
      agency_id = NULL,
      agency_id_basic = NULL,
      agency_id_advanced = NULL,
      agency_id_elite = NULL,
      last_accessed = now()
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$function$;