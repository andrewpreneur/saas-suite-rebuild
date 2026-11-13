-- Function to automatically expire trial users whose trial period has ended
CREATE OR REPLACE FUNCTION public.expire_trial_users()
RETURNS TABLE(expired_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Update users whose trial has expired
  UPDATE saas_suite_users
  SET 
    approval = 'NO',
    agency_id = NULL,
    agency_id_basic = NULL,
    agency_id_advanced = NULL,
    agency_id_elite = NULL,
    last_accessed = now()
  WHERE 
    approval = 'TRIALING'
    AND trial_start_date IS NOT NULL
    AND (trial_start_date + (trial_length || ' days')::interval) <= now();
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN QUERY SELECT affected_rows;
END;
$$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every hour
SELECT cron.schedule(
  'expire-trial-users',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.expire_trial_users();
  $$
);