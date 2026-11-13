CREATE OR REPLACE FUNCTION public.register_affiliate_user(
  user_email text,
  user_affiliate_slug text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := lower(trim(user_email));
  normalized_slug text := lower(trim(user_affiliate_slug));
  existing_user RECORD;
BEGIN
  IF normalized_email IS NULL OR normalized_email = '' THEN
    RETURN FALSE;
  END IF;

  -- Ensure starter row exists
  SELECT id, approval INTO existing_user
  FROM saas_suite_users
  WHERE lower(email) = normalized_email;

  IF existing_user.id IS NULL THEN
    INSERT INTO saas_suite_users (
      email, approval, plan, trial_start_date, source, max_onboarding_users,
      is_affiliate, initial_questions_completed, affiliate_slug
    )
    VALUES (
      normalized_email,
      'STARTER',
      'STARTER',
      NULL,
      'affiliate_signup',
      1,
      TRUE,
      TRUE,
      normalized_slug
    );
  ELSE
    UPDATE saas_suite_users
    SET is_affiliate = TRUE,
        initial_questions_completed = TRUE,
        affiliate_slug = COALESCE(affiliate_slug, normalized_slug)
    WHERE lower(email) = normalized_email;
  END IF;

  -- Link the affiliates record to this user
  IF normalized_slug IS NOT NULL AND normalized_slug <> '' THEN
    UPDATE affiliates
    SET user_email_linked = normalized_email
    WHERE affiliate_slug = normalized_slug;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_affiliate_user(text, text) TO anon, authenticated;