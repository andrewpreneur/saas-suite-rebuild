ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS support_email_alerts jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.account_admins ADD COLUMN IF NOT EXISTS support_email_alerts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_support_email_alert_prefs(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE prefs jsonb;
BEGIN
  SELECT support_email_alerts INTO prefs FROM public.saas_suite_users WHERE lower(email) = lower(btrim(user_email)) LIMIT 1;
  IF prefs IS NULL THEN
    SELECT support_email_alerts INTO prefs FROM public.account_admins WHERE lower(admin_email) = lower(btrim(user_email)) LIMIT 1;
  END IF;
  RETURN coalesce(prefs, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.set_support_email_alert_pref(user_email text, p_key text, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key NOT IN ('alert_assigned_chat','alert_assigned_ticket','alert_assigned_updates','alert_new_unassigned_chats','alert_new_unassigned_tickets') THEN
    RETURN false;
  END IF;
  UPDATE public.saas_suite_users
    SET support_email_alerts = jsonb_set(coalesce(support_email_alerts,'{}'::jsonb), array[p_key], to_jsonb(p_enabled), true)
    WHERE lower(email) = lower(btrim(user_email));
  IF NOT FOUND THEN
    UPDATE public.account_admins
      SET support_email_alerts = jsonb_set(coalesce(support_email_alerts,'{}'::jsonb), array[p_key], to_jsonb(p_enabled), true)
      WHERE lower(admin_email) = lower(btrim(user_email));
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.get_support_email_alert_prefs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_support_email_alert_pref(text, text, boolean) TO authenticated;