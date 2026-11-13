CREATE OR REPLACE FUNCTION public.register_starter_user(user_email text, user_affiliate_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_user RECORD;
  aff_id uuid := NULL;
  resolved_affiliate text;
BEGIN
  SELECT id, approval INTO existing_user
  FROM saas_suite_users
  WHERE lower(email) = lower(user_email);

  IF existing_user.id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  resolved_affiliate := user_affiliate_id;

  IF user_affiliate_id IS NOT NULL AND btrim(user_affiliate_id) <> '' THEN
    SELECT a.id INTO aff_id
    FROM affiliates a
    WHERE a.affiliate_slug = user_affiliate_id
       OR a.id::text = user_affiliate_id
    LIMIT 1;

    IF aff_id IS NOT NULL THEN
      resolved_affiliate := aff_id::text;
    END IF;
  END IF;

  INSERT INTO saas_suite_users (email, approval, plan, trial_start_date, affiliate_id, source, max_onboarding_users)
  VALUES (lower(user_email), 'YES', 'STARTER', NULL, resolved_affiliate, 'signup', 1);

  IF aff_id IS NOT NULL THEN
    INSERT INTO affiliate_referrals (affiliate_id, referred_email, plan, status)
    VALUES (aff_id, lower(user_email), 'STARTER', 'signup')
    ON CONFLICT (affiliate_id, referred_email) DO NOTHING;

    INSERT INTO affiliate_events (affiliate_id, event_type, page)
    VALUES (aff_id, 'signup', 'signup');
  END IF;

  RETURN TRUE;
END;
$function$;