-- Shared cancel claim key, and a delinquency update that fits the API statement timeout.
-- Not applied from an agent. Apply this before deploying expire-payment-grace and
-- stripe-subscription-webhook. Those functions still downgrade and post if this
-- column is missing; the column is what lets both paths claim the subscription key.

ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS cancel_claim_key text;

COMMENT ON COLUMN public.saas_suite_users.cancel_claim_key IS
  'Immediate GoHighLevel cancel claim (subscription id, instant, immediate). expire-payment-grace and stripe-subscription-webhook both honor it.';

-- In-flight schedules already stored the key on subscription_canceled. Copy it
-- so grace does not depend on that lookup. Does not change plan or approval.
UPDATE public.saas_suite_users AS u
SET cancel_claim_key = picked.immediate_claim_key
FROM (
  SELECT DISTINCT ON (lower(e.user_email))
    lower(e.user_email) AS email,
    e.metadata->>'immediate_claim_key' AS immediate_claim_key
  FROM public.customer_message_events e
  JOIN public.saas_suite_users u2
    ON lower(u2.email) = lower(e.user_email)
   AND u2.cancel_access_until IS NOT NULL
  WHERE e.template_key = 'subscription_canceled'
    AND coalesce(e.metadata->>'immediate_claim_key', '') <> ''
    AND (
      coalesce(e.metadata->>'access_until', '') = ''
      OR (
        e.metadata->>'access_until' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
        AND (e.metadata->>'access_until')::timestamptz = u2.cancel_access_until
      )
    )
  ORDER BY lower(e.user_email), e.created_at DESC
) AS picked
WHERE lower(u.email) = picked.email
  AND u.cancel_claim_key IS NULL
  AND u.cancel_access_until IS NOT NULL;

-- One HTTP refresh for the whole delinquency, not one per menu row.
CREATE OR REPLACE FUNCTION public.refresh_branding_cache(_agency_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  aid text;
  base text := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/dynamic-styles';
BEGIN
  IF current_setting('saassuite.skip_branding_refresh', true) = 'on' THEN
    RETURN;
  END IF;
  FOREACH aid IN ARRAY coalesce(_agency_ids, '{}'::text[]) LOOP
    IF aid IS NULL OR btrim(aid) = '' THEN
      CONTINUE;
    END IF;
    PERFORM net.http_get(url := base || '?agency_id=' || urlencode(btrim(aid)) || '&type=css&force=1');
    PERFORM net.http_get(url := base || '?agency_id=' || urlencode(btrim(aid)) || '&type=js&force=1');
  END LOOP;
END;
$$;

-- Billing downgrade must not rewrite agency ids. A legacy "%NO" suffix change
-- fires carry_agency_data_on_id_change, and migrate_agency_id then UPDATEs every
-- public table that has agency_id (dozens of sequential scans). That statement
-- exceeded the API timeout (57014) for kevin@myuig.com on 2026-10-26. The row
-- was already STARTER with approval NO; the timeout rolled the PAST_DUE write back.
-- Menu rules are suspended on the ids the row already has. Branding refreshes once.
CREATE OR REPLACE FUNCTION public.mark_payment_delinquent(user_email text, p_reason text DEFAULT 'canceled')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  u record;
  v_ids text[];
  v_rules int := 0;
  v_had_branding boolean := false;
  v_plan_changed boolean := false;
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  SELECT
    plan::text AS plan,
    billing_state,
    (generated_css IS NOT NULL) AS had_css,
    max_onboarding_users,
    agency_id,
    agency_id_basic,
    agency_id_advanced,
    agency_id_elite
  INTO u
  FROM saas_suite_users
  WHERE lower(email) = lower(btrim(user_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF u.billing_state = 'PAST_DUE' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'already_past_due');
  END IF;

  v_had_branding := u.had_css;
  v_plan_changed := u.plan IS DISTINCT FROM 'STARTER'
    OR u.max_onboarding_users IS DISTINCT FROM 1
    OR u.had_css;

  PERFORM set_config('saassuite.skip_branding_refresh', 'on', true);

  IF v_plan_changed THEN
    UPDATE saas_suite_users
    SET billing_state = 'PAST_DUE',
        plan_before_delinquency = COALESCE(plan_before_delinquency, plan::text),
        plan = 'STARTER'::plan_type,
        max_onboarding_users = 1,
        generated_css_backup = COALESCE(generated_css_backup, generated_css),
        generated_css = NULL,
        branding_suspended_at = COALESCE(branding_suspended_at, now()),
        payment_grace_until = NULL,
        payment_failed_at = COALESCE(payment_failed_at, now()),
        last_accessed = now()
    WHERE lower(email) = lower(btrim(user_email));
  ELSE
    -- Already Starter with no branding to park. Do not mention plan, so plan
    -- triggers and the Lynkific sync do not run for a no-op plan write.
    UPDATE saas_suite_users
    SET billing_state = 'PAST_DUE',
        plan_before_delinquency = COALESCE(plan_before_delinquency, plan::text),
        branding_suspended_at = COALESCE(branding_suspended_at, now()),
        payment_grace_until = NULL,
        payment_failed_at = COALESCE(payment_failed_at, now()),
        last_accessed = now()
    WHERE lower(email) = lower(btrim(user_email));
  END IF;

  v_ids := ARRAY(
    SELECT DISTINCT x
    FROM unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS x
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

  PERFORM set_config('saassuite.skip_branding_refresh', 'off', true);
  PERFORM public.refresh_branding_cache(v_ids);

  RETURN jsonb_build_object(
    'success', true,
    'email', lower(btrim(user_email)),
    'reason', p_reason,
    'had_branding', v_had_branding,
    'menu_link_rules_suspended', v_rules,
    'previous_plan', (SELECT plan_before_delinquency FROM saas_suite_users WHERE lower(email) = lower(btrim(user_email)) LIMIT 1),
    'agency_ids', to_jsonb(v_ids)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_payment_delinquent(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_delinquent(text, text) TO service_role;

CREATE INDEX IF NOT EXISTS menu_link_rules_active_agency_idx
  ON public.menu_link_rules (agency_id)
  WHERE is_active;
