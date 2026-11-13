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
  v_user_id bigint;
  v_match text;
  v_email_norm text;
  v_name_norm text;
  v_new_wallet integer;
  v_access boolean;
  v_agency text;
  v_owner_email text;
  v_owner_name text;
BEGIN
  v_email_norm := NULLIF(lower(trim(COALESCE(_email, ''))), '');
  v_name_norm := NULLIF(lower(trim(COALESCE(_name, ''))), '');

  IF v_email_norm IS NULL AND v_name_norm IS NULL THEN
    RAISE EXCEPTION 'email or name required';
  END IF;

  IF v_email_norm IS NOT NULL THEN
    SELECT u.id INTO v_user_id
    FROM public.saas_suite_users u
    WHERE lower(trim(u.email)) = v_email_norm
    LIMIT 1;
    IF FOUND THEN v_match := 'email'; END IF;
  END IF;

  IF v_user_id IS NULL AND v_name_norm IS NOT NULL THEN
    SELECT u.id INTO v_user_id
    FROM public.saas_suite_users u
    WHERE lower(trim(COALESCE(u.full_name, ''))) = v_name_norm
    LIMIT 1;
    IF FOUND THEN v_match := 'name'; END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.saas_suite_users u
  SET onboarding_call_wallet = GREATEST(COALESCE(u.onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0),
      onboarding_call_access = CASE
        WHEN u.plan::text = 'ADVANCED' THEN true
        WHEN GREATEST(COALESCE(u.onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0) = 0 THEN false
        ELSE u.onboarding_call_access
      END
  WHERE u.id = v_user_id
  RETURNING
    COALESCE(u.agency_id_advanced, u.agency_id_elite, u.agency_id_basic, u.agency_id),
    u.email,
    u.full_name,
    u.onboarding_call_wallet,
    u.onboarding_call_access
  INTO v_agency, v_owner_email, v_owner_name, v_new_wallet, v_access;

  agency_id := v_agency;
  owner_email := v_owner_email;
  owner_name := v_owner_name;
  new_wallet := v_new_wallet;
  access_enabled := v_access;
  matched_by := v_match;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_onboarding_call_by_lookup(text, text, integer) TO service_role;