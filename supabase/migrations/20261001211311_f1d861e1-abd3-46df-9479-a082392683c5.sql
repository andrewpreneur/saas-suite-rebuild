REVOKE EXECUTE ON FUNCTION public.stamp_ticket_assigned_by() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_chat_mode() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_slack_support_alert_prefs(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_slack_support_alert_pref(text, text, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.trg_chat_assignment_sync() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_chat_message_assignee_notify() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_support_reply_assignee_notify() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_slack_ticket_updated() FROM public, anon, authenticated;