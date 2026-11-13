-- Update register_starter_user: set approval=YES, plan=STARTER
CREATE OR REPLACE FUNCTION public.register_starter_user(user_email text, user_affiliate_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_user RECORD;
BEGIN
  SELECT id, approval INTO existing_user
  FROM saas_suite_users
  WHERE lower(email) = lower(user_email);
  
  IF existing_user.id IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  INSERT INTO saas_suite_users (email, approval, plan, trial_start_date, affiliate_id, source, max_onboarding_users)
  VALUES (
    lower(user_email),
    'YES',
    'STARTER',
    NULL,
    user_affiliate_id,
    'signup',
    1
  );
  
  RETURN TRUE;
END;
$function$;

-- Update suspend_user_access: always set approval=NO
CREATE OR REPLACE FUNCTION public.suspend_user_access(user_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id text;
  v_original_agency_id text;
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;

  SELECT agency_id, original_agency_id
    INTO v_agency_id, v_original_agency_id
    FROM saas_suite_users
   WHERE lower(email) = lower(user_email);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE saas_suite_users 
  SET approval = 'NO',
      plan = 'STARTER',
      max_onboarding_users = 1,
      agency_id = CASE 
        WHEN agency_id IS NOT NULL AND NOT agency_id LIKE '%NO' 
        THEN agency_id || 'NO' 
        ELSE agency_id 
      END,
      agency_id_basic = CASE 
        WHEN agency_id_basic IS NOT NULL AND NOT agency_id_basic LIKE '%NO' 
        THEN agency_id_basic || 'NO' 
        ELSE agency_id_basic 
      END,
      agency_id_advanced = CASE 
        WHEN agency_id_advanced IS NOT NULL AND NOT agency_id_advanced LIKE '%NO' 
        THEN agency_id_advanced || 'NO' 
        ELSE agency_id_advanced 
      END,
      agency_id_elite = CASE 
        WHEN agency_id_elite IS NOT NULL AND NOT agency_id_elite LIKE '%NO' 
        THEN agency_id_elite || 'NO' 
        ELSE agency_id_elite 
      END,
      last_accessed = now()
  WHERE lower(email) = lower(user_email);

  RETURN FOUND;
END;
$function$;

-- Drop old trial functions
DROP FUNCTION IF EXISTS public.start_user_trial(text);
DROP FUNCTION IF EXISTS public.start_user_trial(text, integer);
DROP FUNCTION IF EXISTS public.expire_trial_users();
DROP FUNCTION IF EXISTS public.get_user_trial_info(text);

-- Migrate existing data: convert all non-YES/NO approvals to YES
UPDATE saas_suite_users
SET approval = 'YES'
WHERE approval IS NOT NULL 
  AND approval NOT IN ('YES', 'NO');

UPDATE saas_suite_users
SET approval = 'YES'
WHERE approval IS NULL OR approval = '';

-- Drop the YES to TRIALING prevention trigger
DROP TRIGGER IF EXISTS prevent_yes_to_trialing ON saas_suite_users;
DROP FUNCTION IF EXISTS public.prevent_yes_to_trialing_fn();