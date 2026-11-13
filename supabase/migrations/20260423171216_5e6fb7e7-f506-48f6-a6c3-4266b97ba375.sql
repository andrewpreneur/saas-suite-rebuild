
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS bonuses_phone text;

CREATE OR REPLACE FUNCTION public.register_bonuses_user(
  user_email text,
  user_affiliate_id text DEFAULT NULL::text,
  user_full_name text DEFAULT NULL::text,
  user_phone text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_user RECORD;
BEGIN
  SELECT id, approval, plan, full_name, bonuses_phone INTO existing_user
  FROM saas_suite_users
  WHERE lower(email) = lower(user_email);

  IF existing_user.id IS NOT NULL THEN
    UPDATE saas_suite_users
    SET approval = 'YES',
        plan = 'BASIC',
        max_onboarding_users = GREATEST(COALESCE(max_onboarding_users, 0), 5),
        source = COALESCE(source, 'bonuses-dallas'),
        full_name = COALESCE(NULLIF(trim(user_full_name), ''), full_name),
        bonuses_phone = COALESCE(NULLIF(trim(user_phone), ''), bonuses_phone)
    WHERE lower(email) = lower(user_email);
    RETURN TRUE;
  END IF;

  INSERT INTO saas_suite_users (
    email, approval, plan, trial_start_date, affiliate_id, source,
    max_onboarding_users, full_name, bonuses_phone
  )
  VALUES (
    lower(user_email),
    'YES',
    'BASIC',
    NULL,
    user_affiliate_id,
    'bonuses-dallas',
    5,
    NULLIF(trim(user_full_name), ''),
    NULLIF(trim(user_phone), '')
  );

  RETURN TRUE;
END;
$function$;
