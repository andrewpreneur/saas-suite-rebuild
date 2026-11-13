ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS billing_state text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS generated_css_backup text,
  ADD COLUMN IF NOT EXISTS branding_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_before_delinquency text;

ALTER TABLE public.menu_link_rules
  ADD COLUMN IF NOT EXISTS suspended_by_billing boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_payment_delinquent(user_email text, p_reason text DEFAULT 'canceled')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  u saas_suite_users%ROWTYPE;
  v_ids text[];
  v_rules int := 0;
  v_had_branding boolean := false;
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  SELECT * INTO u FROM saas_suite_users WHERE lower(email) = lower(btrim(user_email)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF u.billing_state = 'PAST_DUE' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'already_past_due');
  END IF;

  v_had_branding := u.generated_css IS NOT NULL;

  UPDATE saas_suite_users
  SET billing_state = 'PAST_DUE',
      -- Manual blocks own approval='NO'; billing never blocks the owner's login.
      approval = CASE WHEN approval = 'NO' THEN 'YES' ELSE approval END,
      plan_before_delinquency = COALESCE(plan_before_delinquency, plan::text),
      plan = 'STARTER'::plan_type,
      max_onboarding_users = 1,
      generated_css_backup = COALESCE(generated_css_backup, generated_css),
      generated_css = NULL,
      branding_suspended_at = COALESCE(branding_suspended_at, now()),
      -- undo any legacy "NO" suffix so hub URLs keep resolving
      agency_id = CASE WHEN agency_id LIKE '%NO' THEN left(agency_id, length(agency_id) - 2) ELSE agency_id END,
      agency_id_basic = CASE WHEN agency_id_basic LIKE '%NO' THEN left(agency_id_basic, length(agency_id_basic) - 2) ELSE agency_id_basic END,
      agency_id_advanced = CASE WHEN agency_id_advanced LIKE '%NO' THEN left(agency_id_advanced, length(agency_id_advanced) - 2) ELSE agency_id_advanced END,
      agency_id_elite = CASE WHEN agency_id_elite LIKE '%NO' THEN left(agency_id_elite, length(agency_id_elite) - 2) ELSE agency_id_elite END,
      payment_grace_until = NULL,
      payment_failed_at = COALESCE(payment_failed_at, now()),
      last_accessed = now()
  WHERE lower(email) = lower(btrim(user_email));

  SELECT * INTO u FROM saas_suite_users WHERE lower(email) = lower(btrim(user_email)) LIMIT 1;

  v_ids := ARRAY(
    SELECT x FROM unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS x
    WHERE x IS NOT NULL AND btrim(x) <> ''
  );

  IF array_length(v_ids, 1) > 0 THEN
    WITH upd AS (
      UPDATE menu_link_rules
      SET is_active = false, suspended_by_billing = true
      WHERE agency_id = ANY(v_ids) AND is_active = true
      RETURNING 1
    )
    SELECT count(*) INTO v_rules FROM upd;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'email', lower(btrim(user_email)),
    'reason', p_reason,
    'had_branding', v_had_branding,
    'menu_link_rules_suspended', v_rules,
    'previous_plan', u.plan_before_delinquency,
    'agency_ids', to_jsonb(v_ids)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_payment_delinquency(user_email text, p_plan text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  u saas_suite_users%ROWTYPE;
  v_plan text;
  v_ids text[];
  v_rules int := 0;
  v_branding_restored boolean := false;
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  SELECT * INTO u FROM saas_suite_users WHERE lower(email) = lower(btrim(user_email)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  v_plan := upper(COALESCE(NULLIF(btrim(COALESCE(p_plan, '')), ''), u.plan_before_delinquency, u.plan::text, 'STARTER'));
  IF v_plan NOT IN ('STARTER', 'BASIC', 'ADVANCED') THEN
    v_plan := 'STARTER';
  END IF;

  v_branding_restored := u.generated_css IS NULL AND u.generated_css_backup IS NOT NULL;

  UPDATE saas_suite_users
  SET billing_state = 'ACTIVE',
      approval = CASE WHEN approval = 'NO' THEN 'YES' ELSE approval END,
      plan = v_plan::plan_type,
      max_onboarding_users = CASE WHEN v_plan = 'STARTER' THEN 1 WHEN v_plan = 'BASIC' THEN 5 ELSE NULL END,
      generated_css = COALESCE(generated_css, generated_css_backup),
      generated_css_backup = NULL,
      branding_suspended_at = NULL,
      plan_before_delinquency = NULL,
      payment_failed_at = NULL,
      payment_grace_until = NULL,
      payment_failure_count = 0,
      last_accessed = now()
  WHERE lower(email) = lower(btrim(user_email));

  SELECT * INTO u FROM saas_suite_users WHERE lower(email) = lower(btrim(user_email)) LIMIT 1;

  v_ids := ARRAY(
    SELECT x FROM unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS x
    WHERE x IS NOT NULL AND btrim(x) <> ''
  );

  IF array_length(v_ids, 1) > 0 THEN
    WITH upd AS (
      UPDATE menu_link_rules
      SET is_active = true, suspended_by_billing = false
      WHERE agency_id = ANY(v_ids) AND suspended_by_billing = true
      RETURNING 1
    )
    SELECT count(*) INTO v_rules FROM upd;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'email', lower(btrim(user_email)),
    'plan', v_plan,
    'branding_restored', v_branding_restored,
    'menu_link_rules_restored', v_rules
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.agency_billing_state(p_agency_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(s.billing_state, 'ACTIVE')
  FROM saas_suite_users s
  WHERE p_agency_id IS NOT NULL AND btrim(p_agency_id) <> ''
    AND (s.agency_id = p_agency_id
      OR s.agency_id_basic = p_agency_id
      OR s.agency_id_advanced = p_agency_id
      OR s.agency_id_elite = p_agency_id)
  LIMIT 1;
$function$;

-- While an agency is past due, only their chronologically-first customer may log in.
CREATE OR REPLACE FUNCTION public.check_agency_at_capacity(p_agency_id text, p_user_email text DEFAULT NULL::text, p_user_name text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit_data record;
  v_has_existing_access boolean := false;
  v_billing_state text;
  v_first_id uuid;
  v_match_id uuid;
BEGIN
  IF p_agency_id IS NULL OR btrim(p_agency_id) = '' THEN
    RETURN true;
  END IF;

  IF p_user_email IS NOT NULL AND btrim(p_user_email) <> '' THEN
    SELECT up.id INTO v_match_id
    FROM public.user_progress up
    WHERE lower(btrim(up.email)) = lower(btrim(p_user_email))
      AND up.agency_id = p_agency_id
    ORDER BY up.created_at ASC NULLS LAST
    LIMIT 1;
  ELSIF p_user_name IS NOT NULL AND btrim(p_user_name) <> '' THEN
    SELECT up.id INTO v_match_id
    FROM public.user_progress up
    WHERE up.name = p_user_name
      AND up.agency_id = p_agency_id
    ORDER BY up.created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  v_has_existing_access := v_match_id IS NOT NULL;

  v_billing_state := public.agency_billing_state(p_agency_id);

  IF v_billing_state = 'PAST_DUE' THEN
    SELECT up.id INTO v_first_id
    FROM public.user_progress up
    WHERE up.agency_id = p_agency_id
    ORDER BY up.created_at ASC NULLS LAST, up.id ASC
    LIMIT 1;

    -- Only the first customer ever added keeps access; everyone else is blocked.
    IF v_match_id IS NOT NULL AND v_first_id IS NOT NULL AND v_match_id = v_first_id THEN
      RETURN false;
    END IF;
    RETURN true;
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
$function$;

-- Grace expiry now marks past due instead of hard-suspending.
CREATE OR REPLACE FUNCTION public.expired_payment_grace_users()
RETURNS TABLE(email text, payment_grace_until timestamp with time zone, payment_failure_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT email, payment_grace_until, payment_failure_count
  FROM saas_suite_users
  WHERE payment_grace_until IS NOT NULL
    AND payment_grace_until < now()
    AND COALESCE(billing_state, 'ACTIVE') <> 'PAST_DUE'
    AND approval = 'YES'
    AND payment_failed_at IS NOT NULL;
$function$;