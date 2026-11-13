REVOKE EXECUTE ON FUNCTION public.get_support_email_alert_prefs(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_support_email_alert_pref(text, text, boolean) FROM public, anon;

CREATE OR REPLACE FUNCTION public.get_support_email_alert_prefs(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE prefs jsonb; caller text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF caller = '' OR caller <> lower(btrim(user_email)) THEN RETURN NULL; END IF;
  SELECT support_email_alerts INTO prefs FROM public.saas_suite_users WHERE lower(email) = caller LIMIT 1;
  IF prefs IS NULL THEN
    SELECT support_email_alerts INTO prefs FROM public.account_admins WHERE lower(admin_email) = caller LIMIT 1;
  END IF;
  RETURN coalesce(prefs, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.set_support_email_alert_pref(user_email text, p_key text, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE caller text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF caller = '' OR caller <> lower(btrim(user_email)) THEN RETURN false; END IF;
  IF p_key NOT IN ('alert_assigned_chat','alert_assigned_ticket','alert_assigned_updates','alert_new_unassigned_chats','alert_new_unassigned_tickets') THEN
    RETURN false;
  END IF;
  UPDATE public.saas_suite_users
    SET support_email_alerts = jsonb_set(coalesce(support_email_alerts,'{}'::jsonb), array[p_key], to_jsonb(p_enabled), true)
    WHERE lower(email) = caller;
  IF NOT FOUND THEN
    UPDATE public.account_admins
      SET support_email_alerts = jsonb_set(coalesce(support_email_alerts,'{}'::jsonb), array[p_key], to_jsonb(p_enabled), true)
      WHERE lower(admin_email) = caller;
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;
  RETURN true;
END $$;