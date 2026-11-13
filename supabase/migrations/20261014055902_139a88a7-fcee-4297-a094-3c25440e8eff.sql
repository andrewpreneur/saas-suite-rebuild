CREATE OR REPLACE FUNCTION public.cleanup_deleted_auth_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text := lower(trim(OLD.email));
  v_ids text[];
  v_table text;
BEGIN
  SELECT array_remove(array_agg(DISTINCT aid), NULL) INTO v_ids
  FROM public.saas_suite_users s CROSS JOIN LATERAL unnest(ARRAY[s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite,s.original_agency_id,s.original_agency_id_basic,s.original_agency_id_advanced,s.original_agency_id_elite]) aid
  WHERE lower(trim(s.email)) = v_email;
  IF EXISTS (SELECT 1 FROM public.saas_suite_users s WHERE lower(trim(s.email)) <> v_email AND ARRAY[s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite,s.original_agency_id,s.original_agency_id_basic,s.original_agency_id_advanced,s.original_agency_id_elite] && v_ids) THEN
    RAISE EXCEPTION 'Account has shared workspace identifiers; contact support before deleting';
  END IF;
  -- Fixed table allowlist, bound values: no caller-controlled identifiers or SQL.
  FOREACH v_table IN ARRAY ARRAY['menu_automation_events','menu_link_rules','menu_automations','ghl_custom_menus_cache','ghl_locations_cache','ghl_connections','agency_api_keys','slack_channel_agency_map','slack_link_tokens','slack_oauth_states','slack_workspace_links','external_platform_events','external_platform_connections','training_doc_chunks','ai_support_message_ratings','ai_support_feedback','ai_chat_failures','ai_chat_messages','ai_chat_rate_limits','support_chat_assignments','support_ticket_assign_rules','team_reply_webhook_throttle','support_tickets','chat_threads','agency_support_messages','agency_owner_messages','custom_onboarding_videos','custom_modules','agency_category_settings','agency_daily_checklist','agency_guest_counter','agency_menu_config','agency_module_name_overrides','agency_onboarding_checklist','agency_ui_versions','agency_video_settings','banned_users','hub_ip_sessions','hub_session_revocations','kb_hidden_items','location_mappings','simple_page_settings','simple_page_videos','user_onboarding_checklist_completion','user_progress','v2_home_settings','workflows'] LOOP
    EXECUTE format('DELETE FROM public.%I WHERE agency_id = ANY($1)', v_table) USING v_ids;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['copilot_message_ratings','copilot_pending_suggestions','copilot_chat_messages','copilot_nudges','copilot_nudge_topics','copilot_nudge_settings','copilot_ai_paused','copilot_preferences','copilot_threads','agency_join_requests','onboarding_owner_aliases','support_assignment_settings'] LOOP
    EXECUTE format('DELETE FROM public.%I WHERE lower(trim(owner_email)) = $1', v_table) USING v_email;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['marketing_tool_data','email_warmup_requests','free_leads','user_tool_data','user_dismissed_tips','user_activity_sessions','client_error_logs','site_analytics_events'] LOOP
    EXECUTE format('DELETE FROM public.%I WHERE lower(trim(user_email)) = $1', v_table) USING v_email;
  END LOOP;
  DELETE FROM public.account_admins WHERE lower(trim(owner_email))=v_email OR lower(trim(admin_email))=v_email;
  DELETE FROM public.community_profiles WHERE id=OLD.id OR lower(trim(email))=v_email;
  DELETE FROM public.saas_suite_users WHERE lower(trim(email))=v_email;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.cleanup_deleted_auth_account() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cleanup_deleted_auth_account BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_auth_account();