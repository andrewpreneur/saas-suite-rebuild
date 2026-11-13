DROP FUNCTION IF EXISTS public.check_agency_at_capacity(text);

CREATE OR REPLACE FUNCTION public.check_agency_at_capacity(
  p_agency_id text,
  p_user_email text DEFAULT NULL,
  p_user_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_data record;
  v_has_existing_access boolean := false;
BEGIN
  IF p_agency_id IS NULL OR btrim(p_agency_id) = '' THEN
    RETURN true;
  END IF;

  IF p_user_email IS NOT NULL AND btrim(p_user_email) <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_progress up
      WHERE lower(btrim(up.email)) = lower(btrim(p_user_email))
        AND up.agency_id = p_agency_id
    ) INTO v_has_existing_access;
  ELSIF p_user_name IS NOT NULL AND btrim(p_user_name) <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_progress up
      WHERE up.name = p_user_name
        AND up.agency_id = p_agency_id
    ) INTO v_has_existing_access;
  END IF;

  IF v_has_existing_access THEN
    RETURN false;
  END IF;

  SELECT current_users, max_users
  INTO v_limit_data
  FROM public.get_agency_user_limit(p_agency_id)
  LIMIT 1;

  IF v_limit_data IS NULL OR v_limit_data.max_users IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_limit_data.current_users >= v_limit_data.max_users;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_agency_assignment(user_email text, agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email text;
BEGIN
  v_normalized_email := lower(btrim(user_email));

  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RETURN false;
  END IF;

  IF agency_id IS NULL OR btrim(agency_id) = '' THEN
    RETURN false;
  END IF;

  IF public.check_agency_at_capacity(btrim(agency_id), v_normalized_email, NULL) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_progress (email, agency_id, created_at, last_accessed)
  VALUES (v_normalized_email, btrim(agency_id), now(), now())
  ON CONFLICT (email)
  DO UPDATE SET
    agency_id = EXCLUDED.agency_id,
    last_accessed = now(),
    created_at = COALESCE(public.user_progress.created_at, EXCLUDED.created_at);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_agency_assignment_with_name(
  agency_id text,
  user_email text DEFAULT NULL,
  user_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email text;
  v_normalized_name text;
BEGIN
  v_normalized_email := NULLIF(lower(btrim(user_email)), '');
  v_normalized_name := NULLIF(btrim(user_name), '');

  IF v_normalized_email IS NULL AND v_normalized_name IS NULL THEN
    RETURN false;
  END IF;

  IF agency_id IS NULL OR btrim(agency_id) = '' THEN
    RETURN false;
  END IF;

  IF public.check_agency_at_capacity(btrim(agency_id), v_normalized_email, v_normalized_name) THEN
    RETURN false;
  END IF;

  IF v_normalized_email IS NOT NULL THEN
    INSERT INTO public.user_progress (email, agency_id, created_at, last_accessed)
    VALUES (v_normalized_email, btrim(agency_id), now(), now())
    ON CONFLICT (email)
    DO UPDATE SET
      agency_id = EXCLUDED.agency_id,
      last_accessed = now(),
      created_at = COALESCE(public.user_progress.created_at, EXCLUDED.created_at);
  ELSE
    INSERT INTO public.user_progress (name, agency_id, created_at, last_accessed)
    VALUES (v_normalized_name, btrim(agency_id), now(), now())
    ON CONFLICT (name)
    DO UPDATE SET
      agency_id = EXCLUDED.agency_id,
      last_accessed = now(),
      created_at = COALESCE(public.user_progress.created_at, EXCLUDED.created_at);
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;