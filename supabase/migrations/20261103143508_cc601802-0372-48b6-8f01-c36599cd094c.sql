ALTER FUNCTION public.cleanup_account_for_deletion(uuid) RENAME TO cleanup_account_for_deletion_base;
REVOKE ALL ON FUNCTION public.cleanup_account_for_deletion_base(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_account_for_deletion_base(uuid) TO service_role;
CREATE FUNCTION public.cleanup_account_for_deletion(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_email text; v_ids text[]; v_profile_id bigint; v_learner_ids uuid[];
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id=p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  SELECT id INTO v_profile_id FROM public.saas_suite_users WHERE lower(trim(email))=v_email;
  SELECT array_remove(array_agg(DISTINCT aid),NULL) INTO v_ids FROM public.saas_suite_users s CROSS JOIN LATERAL unnest(ARRAY[s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite,s.original_agency_id,s.original_agency_id_basic,s.original_agency_id_advanced,s.original_agency_id_elite]) aid WHERE lower(trim(s.email))=v_email;
  IF EXISTS(SELECT 1 FROM public.saas_suite_users s WHERE lower(trim(s.email))<>v_email AND ARRAY[s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite,s.original_agency_id,s.original_agency_id_basic,s.original_agency_id_advanced,s.original_agency_id_elite] && v_ids) THEN RAISE EXCEPTION 'Shared workspace identifiers'; END IF;
  SELECT array_agg(id) INTO v_learner_ids FROM public.user_progress WHERE agency_id=ANY(v_ids);
  DELETE FROM public.module_completion WHERE user_id=ANY(v_learner_ids) OR user_id=p_user_id;
  DELETE FROM public.challenge_point_reviews WHERE user_id=ANY(v_learner_ids) OR entry_id IN (SELECT id FROM public.giveaway_entries WHERE agency_id=ANY(v_ids) OR lower(trim(email))=v_email);
  DELETE FROM public.giveaway_entries WHERE agency_id=ANY(v_ids) OR lower(trim(email))=v_email;
  DELETE FROM public.agency_projects WHERE agency_id=ANY(v_ids) OR lower(trim(owner_email))=v_email;
  DELETE FROM public.agency_support_clients WHERE lower(trim(owner_email))=v_email;
  DELETE FROM public.agency_ticket_categories WHERE lower(trim(owner_email))=v_email;
  DELETE FROM public.agency_training_seed_jobs WHERE agency_id=ANY(v_ids);
  DELETE FROM public.location_themes WHERE agency_id=ANY(v_ids);
  DELETE FROM public.theme_logos WHERE agency_id=ANY(v_ids);
  DELETE FROM public.public_copilot_messages WHERE lower(trim(claimed_by))=v_email;
  DELETE FROM public.community_academy_progress WHERE user_id=p_user_id;
  DELETE FROM public.academy_notify_requests WHERE user_id=p_user_id OR lower(trim(email))=v_email;
  DELETE FROM public.login_events WHERE auth_user_id=p_user_id OR lower(trim(user_email))=v_email;
  DELETE FROM public.user_onboarding_responses WHERE user_id=p_user_id;
  DELETE FROM public.admin_list_members WHERE lower(trim(user_email))=v_email;
  DELETE FROM public.setup_tracker_accounts WHERE saas_suite_user_id=v_profile_id OR lower(trim(contact_email))=v_email;
  DELETE FROM public.platform_support_excluded_agencies WHERE lower(trim(owner_email))=v_email;
  DELETE FROM public.auth_password_codes WHERE lower(trim(email))=v_email;
  DELETE FROM public.auth_signup_failures WHERE lower(trim(email))=v_email;
  DELETE FROM public.agency_id_migrations WHERE lower(trim(user_email))=v_email;
  PERFORM public.cleanup_account_for_deletion_base(p_user_id);
END; $$;
REVOKE ALL ON FUNCTION public.cleanup_account_for_deletion(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_account_for_deletion(uuid) TO service_role;