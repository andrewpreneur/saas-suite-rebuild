ALTER FUNCTION public.support_canonical_category(text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.support_is_team_member(text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_pick_assignee(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_auto_assign_chat() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_support_notification_settings(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_support_email_alert_pref_for(text,text,boolean) FROM PUBLIC, anon;