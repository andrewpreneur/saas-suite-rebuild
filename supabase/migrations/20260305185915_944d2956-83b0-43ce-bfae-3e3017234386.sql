
-- Update register_starter_user to set max_onboarding_users = 1
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
  SELECT id, approval INTO existing_user
  FROM saas_suite_users
  WHERE lower(email) = lower(user_email);
  
  IF existing_user.id IS NOT NULL THEN
    IF existing_user.approval = 'YES' THEN
      RETURN TRUE;
    END IF;
    UPDATE saas_suite_users
    SET approval = 'STARTER',
        plan = 'STARTER',
        trial_start_date = NULL,
        max_onboarding_users = 1
    WHERE lower(email) = lower(user_email)
      AND approval != 'YES';
    RETURN TRUE;
  END IF;
  
  INSERT INTO saas_suite_users (email, approval, plan, trial_start_date, affiliate_id, source, max_onboarding_users)
  VALUES (
    lower(user_email),
    'STARTER',
    'STARTER',
    NULL,
    user_affiliate_id,
    'signup',
    1
  );
  
  RETURN TRUE;
END;
$$;

-- Update existing STARTER users to have max_onboarding_users = 1
UPDATE saas_suite_users
SET max_onboarding_users = 1
WHERE plan = 'STARTER' AND (max_onboarding_users IS NULL OR max_onboarding_users != 1);

-- Update existing BASIC users to have max_onboarding_users = 5
UPDATE saas_suite_users
SET max_onboarding_users = 5
WHERE plan = 'BASIC' AND (max_onboarding_users IS NULL OR max_onboarding_users != 5);

-- Keep ADVANCED as NULL (unlimited) - no change needed
-- Keep dan@quantumcollective.com grandfathered as NULL (unlimited)
UPDATE saas_suite_users
SET max_onboarding_users = NULL
WHERE lower(email) = 'dan@quantumcollective.com';
