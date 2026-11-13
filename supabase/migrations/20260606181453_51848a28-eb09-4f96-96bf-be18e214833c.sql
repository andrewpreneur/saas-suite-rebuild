
CREATE OR REPLACE FUNCTION public.consume_onboarding_call_by_lookup(
  _email text,
  _name text DEFAULT NULL,
  _amount integer DEFAULT 1
)
RETURNS TABLE(
  agency_id text,
  owner_email text,
  owner_name text,
  new_wallet integer,
  access_enabled boolean,
  matched_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_match text;
  v_email_norm text;
  v_name_norm text;
BEGIN
  v_email_norm := NULLIF(lower(trim(COALESCE(_email, ''))), '');
  v_name_norm := NULLIF(lower(trim(COALESCE(_name, ''))), '');

  IF v_email_norm IS NULL AND v_name_norm IS NULL THEN
    RAISE EXCEPTION 'email or name required';
  END IF;

  -- Try email first
  IF v_email_norm IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM public.saas_suite_users
    WHERE lower(trim(email)) = v_email_norm
    LIMIT 1;
    IF FOUND THEN v_match := 'email'; END IF;
  END IF;

  -- Fall back to name
  IF v_user_id IS NULL AND v_name_norm IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM public.saas_suite_users
    WHERE lower(trim(COALESCE(full_name, ''))) = v_name_norm
    LIMIT 1;
    IF FOUND THEN v_match := 'name'; END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.saas_suite_users
  SET onboarding_call_wallet = GREATEST(COALESCE(onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0),
      onboarding_call_access = CASE
        WHEN plan = 'ADVANCED' THEN true
        WHEN GREATEST(COALESCE(onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0) = 0 THEN false
        ELSE onboarding_call_access
      END
  WHERE id = v_user_id
  RETURNING
    COALESCE(agency_id_advanced, agency_id_elite, agency_id_basic, agency_id),
    email,
    full_name,
    onboarding_call_wallet,
    onboarding_call_access,
    v_match
  INTO agency_id, owner_email, owner_name, new_wallet, access_enabled, matched_by;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_onboarding_call_by_lookup(text, text, integer) TO service_role;
