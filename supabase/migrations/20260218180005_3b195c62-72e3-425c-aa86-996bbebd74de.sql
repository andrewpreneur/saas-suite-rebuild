
-- Fix Tate's account
UPDATE saas_suite_users 
SET approval = 'STARTER', plan = 'STARTER', trial_start_date = NULL 
WHERE lower(email) = 'tate@mtnpeaksolutions.com';

-- Create a function to register new free-tier (STARTER) users
CREATE OR REPLACE FUNCTION public.register_starter_user(
  user_email text,
  user_affiliate_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user RECORD;
BEGIN
  -- Check if user already exists
  SELECT id, approval INTO existing_user
  FROM saas_suite_users
  WHERE lower(email) = lower(user_email);
  
  IF existing_user.id IS NOT NULL THEN
    -- User exists - don't downgrade from YES
    IF existing_user.approval = 'YES' THEN
      RETURN TRUE;
    END IF;
    -- Update existing user to STARTER if not already approved
    UPDATE saas_suite_users
    SET approval = 'STARTER',
        plan = 'STARTER',
        trial_start_date = NULL
    WHERE lower(email) = lower(user_email)
      AND approval != 'YES';
    RETURN TRUE;
  END IF;
  
  -- Create new user as STARTER
  INSERT INTO saas_suite_users (email, approval, plan, trial_start_date, affiliate_id, source)
  VALUES (
    lower(user_email),
    'STARTER',
    'STARTER',
    NULL,
    user_affiliate_id,
    'signup'
  );
  
  RETURN TRUE;
END;
$$;
