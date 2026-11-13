-- Update register_user_safe function to handle affiliate_id
CREATE OR REPLACE FUNCTION public.register_user_safe(user_email text, user_approval text DEFAULT 'PENDING'::text, user_affiliate_id text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_id bigint;
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;
  
  -- Check if user already exists
  SELECT id INTO user_id FROM saas_suite_users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    -- Create new user record with affiliate_id
    INSERT INTO saas_suite_users (email, approval, affiliate_id) 
    VALUES (user_email, user_approval, user_affiliate_id) 
    RETURNING id INTO user_id;
  END IF;
  
  RETURN user_id;
END;
$function$;

-- Update start_user_trial function to handle affiliate_id
CREATE OR REPLACE FUNCTION public.start_user_trial(user_email text, user_affiliate_id text DEFAULT NULL::text)
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
  
  -- Update or insert user with trial status and affiliate_id
  INSERT INTO saas_suite_users (email, approval, trial_start_date, affiliate_id, created_at)
  VALUES (user_email, 'TRIALING', now(), user_affiliate_id, now())
  ON CONFLICT (email)
  DO UPDATE SET 
    approval = 'TRIALING',
    trial_start_date = CASE 
      WHEN saas_suite_users.trial_start_date IS NULL THEN now()
      ELSE saas_suite_users.trial_start_date
    END,
    affiliate_id = COALESCE(EXCLUDED.affiliate_id, saas_suite_users.affiliate_id),
    last_accessed = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;