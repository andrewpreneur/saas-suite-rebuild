-- Resolve affiliate slug -> affiliate uuid and record a referral at signup time
CREATE OR REPLACE FUNCTION public.register_starter_user(user_email text, user_affiliate_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user RECORD;
  aff RECORD;
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
    SELECT a.id, a.affiliate_slug INTO aff
    FROM affiliates a
    WHERE a.affiliate_slug = user_affiliate_id
       OR a.id::text = user_affiliate_id
    LIMIT 1;

    IF aff.id IS NOT NULL THEN
      resolved_affiliate := aff.id::text;
    END IF;
  END IF;

  INSERT INTO saas_suite_users (email, approval, plan, trial_start_date, affiliate_id, source, max_onboarding_users)
  VALUES (lower(user_email), 'YES', 'STARTER', NULL, resolved_affiliate, 'signup', 1);

  IF aff.id IS NOT NULL THEN
    INSERT INTO affiliate_referrals (affiliate_id, referred_email, plan, status)
    VALUES (aff.id, lower(user_email), 'STARTER', 'signup')
    ON CONFLICT (affiliate_id, referred_email) DO NOTHING;

    INSERT INTO affiliate_events (affiliate_id, event_type, page)
    VALUES (aff.id, 'signup', 'signup');
  END IF;

  RETURN TRUE;
END;
$$;

-- Backfill: Amir's referral for Antony Torres
UPDATE public.saas_suite_users
SET affiliate_id = 'bbe23038-98ba-4b2c-9367-ba499faf28cf'
WHERE lower(email) = 'tony@gladmarketing.com';

INSERT INTO public.affiliate_referrals (affiliate_id, referred_email, referred_name, plan, status)
VALUES ('bbe23038-98ba-4b2c-9367-ba499faf28cf', 'tony@gladmarketing.com', 'Antony Torres', 'BASIC', 'converted')
ON CONFLICT (affiliate_id, referred_email) DO UPDATE
SET plan = EXCLUDED.plan, status = EXCLUDED.status, referred_name = EXCLUDED.referred_name;

UPDATE public.affiliates
SET status = 'APPROVED', updated_at = now()
WHERE id = 'bbe23038-98ba-4b2c-9367-ba499faf28cf';