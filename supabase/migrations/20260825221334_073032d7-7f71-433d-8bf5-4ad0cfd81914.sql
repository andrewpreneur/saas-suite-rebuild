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
      plan_before_delinquency = COALESCE(plan_before_delinquency, plan::text),
      plan = 'STARTER'::plan_type,
      max_onboarding_users = 1,
      generated_css_backup = COALESCE(generated_css_backup, generated_css),
      generated_css = NULL,
      branding_suspended_at = COALESCE(branding_suspended_at, now()),
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
    'approval', u.approval,
    'branding_restored', v_branding_restored,
    'menu_link_rules_restored', v_rules
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_approval_by_email(user_email text)
RETURNS TABLE(approval text, has_auth_account boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(ssu.approval, 'YES') as approval,
    (au.id IS NOT NULL) as has_auth_account
  FROM saas_suite_users ssu
  LEFT JOIN auth.users au ON lower(ssu.email) = lower(au.email)
  WHERE lower(ssu.email) = lower(btrim(user_email));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_auth_status_by_email(user_email text)
RETURNS TABLE(user_id uuid, approval text, has_password boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT uas.user_id, COALESCE(uas.approval, 'YES') as approval, uas.has_password
  FROM user_auth_status uas
  INNER JOIN auth.users au ON uas.user_id = au.id
  WHERE lower(au.email) = lower(btrim(user_email));
END;
$function$;