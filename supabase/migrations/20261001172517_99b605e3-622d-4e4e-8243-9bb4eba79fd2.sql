CREATE TABLE public.onboarding_owner_aliases (
  alias_email text PRIMARY KEY,
  owner_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.onboarding_owner_aliases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_owner_aliases TO authenticated;
ALTER TABLE public.onboarding_owner_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage aliases" ON public.onboarding_owner_aliases FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

ALTER TABLE public.onboarding_calls
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorded_by text;

CREATE POLICY "Account team can view onboarding calls" ON public.onboarding_calls FOR SELECT TO authenticated
  USING (owner_email IS NOT NULL AND public.can_access_owner_email(owner_email));

CREATE OR REPLACE FUNCTION public.find_onboarding_owner(_email text, _name text DEFAULT NULL::text)
 RETURNS TABLE(owner_email text, owner_name text, agency_id text, matched_by text, onboarding_autopay boolean, stripe_customer_id text, stripe_payment_method_id text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e text := nullif(lower(btrim(coalesce(_email, ''))), '');
        n text := nullif(lower(btrim(coalesce(_name, ''))), '');
        v_owner text; v_by text;
BEGIN
  IF e IS NOT NULL THEN
    SELECT lower(a.owner_email) INTO v_owner FROM onboarding_owner_aliases a WHERE lower(a.alias_email) = e LIMIT 1;
    IF v_owner IS NOT NULL THEN v_by := 'alias'; END IF;
    IF v_owner IS NULL THEN
      SELECT u.email INTO v_owner FROM saas_suite_users u WHERE lower(btrim(u.email)) = e LIMIT 1;
      IF v_owner IS NOT NULL THEN v_by := 'email'; END IF;
    END IF;
    IF v_owner IS NULL THEN
      SELECT aa.owner_email INTO v_owner FROM account_admins aa WHERE lower(aa.admin_email) = e AND aa.status = 'accepted' LIMIT 1;
      IF v_owner IS NOT NULL THEN v_by := 'admin_email'; END IF;
    END IF;
    IF v_owner IS NULL THEN
      SELECT u.email INTO v_owner FROM user_progress up JOIN saas_suite_users u
        ON up.agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
        WHERE lower(btrim(up.email)) = e ORDER BY up.last_accessed DESC NULLS LAST LIMIT 1;
      IF v_owner IS NOT NULL THEN v_by := 'client_email'; END IF;
    END IF;
  END IF;
  IF v_owner IS NULL AND n IS NOT NULL THEN
    SELECT u.email INTO v_owner FROM saas_suite_users u WHERE lower(btrim(coalesce(u.full_name, ''))) = n
      ORDER BY (lower(u.email) IN (SELECT lower(owner_email) FROM onboarding_owner_aliases)) DESC LIMIT 1;
    IF v_owner IS NOT NULL THEN v_by := 'name'; END IF;
  END IF;
  IF v_owner IS NULL THEN RETURN; END IF;
  SELECT coalesce((SELECT lower(a.owner_email) FROM onboarding_owner_aliases a WHERE lower(a.alias_email) = lower(v_owner)), v_owner) INTO v_owner;
  RETURN QUERY SELECT lower(u.email), u.full_name,
    COALESCE(u.agency_id_advanced, u.agency_id_elite, u.agency_id_basic, u.agency_id), v_by,
    u.onboarding_autopay, u.onboarding_stripe_customer_id, u.onboarding_stripe_payment_method_id
  FROM saas_suite_users u WHERE lower(u.email) = lower(v_owner) LIMIT 1;
END $function$;

CREATE OR REPLACE FUNCTION public.record_manual_onboarding_call(
  p_owner_email text, p_name text, p_email text, p_scheduled_at timestamptz,
  p_meeting_link text, p_transcript text, p_recording_link text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner text := lower(btrim(coalesce(p_owner_email,''))); v_id uuid; v_agency text;
BEGIN
  IF v_owner = '' OR NOT public.can_access_owner_email(v_owner) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT COALESCE(agency_id_advanced, agency_id_elite, agency_id_basic, agency_id) INTO v_agency
    FROM saas_suite_users WHERE lower(email) = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account % not found', v_owner; END IF;
  INSERT INTO onboarding_calls(owner_email, agency_id, name, email, scheduled_at, meeting_link, transcript, recording_link, is_manual, recorded_by)
  VALUES (v_owner, v_agency, nullif(btrim(p_name),''), nullif(lower(btrim(p_email)),''), p_scheduled_at,
          nullif(btrim(p_meeting_link),''), nullif(p_transcript,''), nullif(btrim(p_recording_link),''), true, public.current_auth_email())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.consume_recorded_onboarding_call(p_call_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r onboarding_calls; v_wallet int;
BEGIN
  SELECT * INTO r FROM onboarding_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Call not found'; END IF;
  IF r.owner_email IS NULL OR NOT public.can_access_owner_email(r.owner_email) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF r.consumed_at IS NOT NULL OR r.charge_status = 'charged' THEN RAISE EXCEPTION 'This call was already consumed'; END IF;
  SELECT new_wallet INTO v_wallet FROM public.consume_onboarding_call(r.owner_email, 1);
  UPDATE onboarding_calls SET consumed_at = now(), charge_status = coalesce(charge_status, 'manual_consume') WHERE id = p_call_id;
  RETURN v_wallet;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_manual_onboarding_call(text,text,text,timestamptz,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.consume_recorded_onboarding_call(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_manual_onboarding_call(text,text,text,timestamptz,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_recorded_onboarding_call(uuid) TO authenticated;