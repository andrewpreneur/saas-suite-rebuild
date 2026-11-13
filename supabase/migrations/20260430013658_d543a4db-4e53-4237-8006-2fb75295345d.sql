
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failure_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_saas_suite_users_payment_grace_until
  ON public.saas_suite_users (payment_grace_until)
  WHERE payment_grace_until IS NOT NULL;

-- Update restore_user_access (with plan) to also clear grace fields on any successful payment
CREATE OR REPLACE FUNCTION public.restore_user_access(user_email text, user_plan text DEFAULT 'ADVANCED'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;

  UPDATE saas_suite_users
  SET approval = 'YES',
      plan = CASE
        WHEN upper(user_plan) = 'BASIC' THEN 'BASIC'::plan_type
        WHEN upper(user_plan) = 'STARTER' THEN 'STARTER'::plan_type
        ELSE 'ADVANCED'::plan_type
      END,
      max_onboarding_users = CASE
        WHEN upper(user_plan) = 'STARTER' THEN 1
        WHEN upper(user_plan) = 'BASIC' THEN 5
        ELSE NULL
      END,
      agency_id = CASE WHEN agency_id LIKE '%NO' THEN SUBSTRING(agency_id, 1, LENGTH(agency_id) - 2) ELSE agency_id END,
      agency_id_basic = CASE WHEN agency_id_basic LIKE '%NO' THEN SUBSTRING(agency_id_basic, 1, LENGTH(agency_id_basic) - 2) ELSE agency_id_basic END,
      agency_id_advanced = CASE WHEN agency_id_advanced LIKE '%NO' THEN SUBSTRING(agency_id_advanced, 1, LENGTH(agency_id_advanced) - 2) ELSE agency_id_advanced END,
      agency_id_elite = CASE WHEN agency_id_elite LIKE '%NO' THEN SUBSTRING(agency_id_elite, 1, LENGTH(agency_id_elite) - 2) ELSE agency_id_elite END,
      payment_failed_at = NULL,
      payment_grace_until = NULL,
      payment_failure_count = 0,
      last_accessed = now()
  WHERE lower(email) = lower(user_email);

  RETURN FOUND;
END;
$function$;

-- Helper RPC: start or extend grace period without changing approval
CREATE OR REPLACE FUNCTION public.start_payment_grace(user_email text, grace_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_row saas_suite_users%ROWTYPE;
  result jsonb;
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  SELECT * INTO current_user_row
  FROM saas_suite_users
  WHERE lower(email) = lower(user_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- Already suspended → no-op
  IF current_user_row.approval = 'NO' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'already_suspended');
  END IF;

  -- Already in grace window → just bump counter, don't reset clock or refire emails
  IF current_user_row.payment_grace_until IS NOT NULL AND current_user_row.payment_grace_until > now() THEN
    UPDATE saas_suite_users
    SET payment_failure_count = COALESCE(payment_failure_count, 0) + 1
    WHERE lower(email) = lower(user_email);

    RETURN jsonb_build_object(
      'success', true,
      'already_in_grace', true,
      'grace_until', current_user_row.payment_grace_until,
      'failure_count', COALESCE(current_user_row.payment_failure_count, 0) + 1
    );
  END IF;

  -- Start fresh grace window
  UPDATE saas_suite_users
  SET payment_failed_at = now(),
      payment_grace_until = now() + (grace_days || ' days')::interval,
      payment_failure_count = 1
  WHERE lower(email) = lower(user_email);

  RETURN jsonb_build_object(
    'success', true,
    'already_in_grace', false,
    'grace_until', now() + (grace_days || ' days')::interval,
    'failure_count', 1
  );
END;
$function$;

-- Helper RPC: list users whose grace window has lapsed and still aren't suspended
CREATE OR REPLACE FUNCTION public.expired_payment_grace_users()
 RETURNS TABLE(email text, payment_grace_until timestamptz, payment_failure_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT email, payment_grace_until, payment_failure_count
  FROM saas_suite_users
  WHERE payment_grace_until IS NOT NULL
    AND payment_grace_until < now()
    AND approval = 'YES'
    AND payment_failed_at IS NOT NULL;
$function$;
