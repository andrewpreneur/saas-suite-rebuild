CREATE OR REPLACE FUNCTION public.get_user_initial_questions_status(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN false;
  END IF;

  RETURN COALESCE((
    SELECT initial_questions_completed
    FROM public.saas_suite_users
    WHERE lower(email) = lower(btrim(user_email))
    LIMIT 1
  ), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_user_login(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  user_record record;
  normalized_email text;
  days_since_last_login integer;
  is_weekly_active boolean;
BEGIN
  normalized_email := lower(btrim(user_email));

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email cannot be empty');
  END IF;

  SELECT last_login_at, login_count, weekly_login_count, weekly_login_reset_at
  INTO user_record
  FROM public.saas_suite_users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.register_starter_user(normalized_email, NULL);

    SELECT last_login_at, login_count, weekly_login_count, weekly_login_reset_at
    INTO user_record
    FROM public.saas_suite_users
    WHERE lower(email) = normalized_email
    LIMIT 1;
  END IF;

  days_since_last_login := COALESCE(
    EXTRACT(DAY FROM (now() - user_record.last_login_at))::integer,
    0
  );

  IF user_record.weekly_login_reset_at IS NULL OR
     (now() - user_record.weekly_login_reset_at) > interval '7 days' THEN
    UPDATE public.saas_suite_users
    SET
      last_login_at = now(),
      last_accessed = now(),
      login_count = COALESCE(login_count, 0) + 1,
      weekly_login_count = 1,
      weekly_login_reset_at = now()
    WHERE lower(email) = normalized_email;
  ELSE
    UPDATE public.saas_suite_users
    SET
      last_login_at = now(),
      last_accessed = now(),
      login_count = COALESCE(login_count, 0) + 1,
      weekly_login_count = COALESCE(weekly_login_count, 0) + 1
    WHERE lower(email) = normalized_email;
  END IF;

  SELECT weekly_login_count >= 3 INTO is_weekly_active
  FROM public.saas_suite_users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'days_inactive', days_since_last_login,
    'weekly_active', COALESCE(is_weekly_active, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_access(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_email text;
BEGIN
  normalized_email := lower(btrim(user_email));

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RETURN false;
  END IF;

  UPDATE public.saas_suite_users
  SET last_accessed = now()
  WHERE lower(email) = normalized_email;

  RETURN FOUND;
END;
$$;

UPDATE public.saas_suite_users
SET approval = 'YES',
    last_accessed = now()
WHERE lower(email) = 'brentneyparks@gmail.com';