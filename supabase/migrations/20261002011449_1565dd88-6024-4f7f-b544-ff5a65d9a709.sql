CREATE OR REPLACE FUNCTION public.get_support_alert_context(p_agency_id text, p_user_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE u record; a text; n text; ph text; r text; aid text := regexp_replace(p_agency_id, 'NO$', '', 'i');
BEGIN
  SELECT * INTO u FROM public.saas_suite_users s WHERE aid IN (s.agency_id, s.agency_id_basic, s.agency_id_advanced, s.agency_id_elite) LIMIT 1;
  IF u IS NULL THEN RETURN NULL; END IF;
  IF u.human_chat_mode = 'managed' THEN
    r := 'saassuite'; a := 'team@yoursoftwareonboarding.com'; n := 'SaaSSuite'; ph := NULL;
  ELSE
    SELECT lower(assigned_to_email) INTO a FROM public.support_chat_assignments
      WHERE agency_id = aid AND lower(btrim(user_identifier)) = lower(btrim(p_user_identifier)) LIMIT 1;
    IF a IS NOT NULL THEN
      r := 'assignee';
      SELECT coalesce(nullif(admin_name,''), admin_email), admin_phone INTO n, ph FROM public.account_admins
        WHERE lower(admin_email) = a AND lower(owner_email) = lower(u.email) LIMIT 1;
      IF n IS NULL AND a = lower(u.email) THEN n := u.full_name; ph := u.bonuses_phone; END IF;
    ELSIF upper(coalesce(u.plan,'')) = 'ADVANCED' THEN
      r := 'saassuite'; a := 'team@yoursoftwareonboarding.com'; n := 'SaaSSuite'; ph := NULL;
    ELSE
      r := 'owner_default'; a := lower(u.email); n := u.full_name; ph := u.bonuses_phone;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'human_chat_mode', u.human_chat_mode, 'handled_by', CASE WHEN u.human_chat_mode='managed' OR r='saassuite' THEN 'saassuite' ELSE 'agency' END,
    'ai_chat_enabled', u.ai_chat_enabled, 'human_chat_enabled', u.human_chat_enabled,
    'notify_target', r, 'assigned_to_email', a, 'assigned_to_name', n, 'assigned_to_phone', ph,
    'assigned_default', r IN ('owner_default','saassuite'),
    'account_owner_name', u.full_name, 'account_owner_email', lower(u.email), 'account_owner_phone', u.bonuses_phone,
    'account_name', u.agency_name, 'plan', u.plan);
END $$;