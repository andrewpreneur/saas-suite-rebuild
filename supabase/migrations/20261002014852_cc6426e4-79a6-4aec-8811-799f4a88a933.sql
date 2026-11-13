CREATE TABLE public.support_assignment_settings (
  owner_email text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'owner',
  person_email text,
  rr_members text[] NOT NULL DEFAULT '{}',
  rr_cursor integer NOT NULL DEFAULT 0,
  fallback_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_assignment_settings TO authenticated;
GRANT ALL ON public.support_assignment_settings TO service_role;
ALTER TABLE public.support_assignment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view assignment settings" ON public.support_assignment_settings FOR SELECT TO authenticated
  USING (public.can_access_owner_email(owner_email));
CREATE POLICY "Owner manages assignment settings" ON public.support_assignment_settings FOR ALL TO authenticated
  USING (lower(owner_email) = public.current_auth_email() OR public.is_platform_admin())
  WITH CHECK (lower(owner_email) = public.current_auth_email() OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.guard_support_assignment_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.owner_email := lower(btrim(NEW.owner_email));
  IF NEW.mode NOT IN ('owner','person','round_robin','category') THEN RAISE EXCEPTION 'invalid mode'; END IF;
  NEW.person_email := nullif(lower(btrim(coalesce(NEW.person_email,''))),'');
  NEW.fallback_email := nullif(lower(btrim(coalesce(NEW.fallback_email,''))),'');
  NEW.rr_members := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM unnest(coalesce(NEW.rr_members,'{}')) x WHERE btrim(x) <> '');
  IF NEW.mode = 'person' AND NEW.person_email IS NULL THEN RAISE EXCEPTION 'Pick a person'; END IF;
  IF NEW.mode = 'round_robin' AND cardinality(NEW.rr_members) < 1 THEN RAISE EXCEPTION 'Pick at least one person'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_support_assignment_settings BEFORE INSERT OR UPDATE ON public.support_assignment_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_support_assignment_settings();

-- Is this email on the owner's team (owner or accepted admin)?
CREATE OR REPLACE FUNCTION public.support_is_team_member(p_owner text, p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_email IS NOT NULL AND (lower(p_email) = lower(p_owner) OR EXISTS (
    SELECT 1 FROM public.account_admins a WHERE lower(a.owner_email) = lower(p_owner)
      AND lower(a.admin_email) = lower(p_email) AND a.status = 'accepted'));
$$;

CREATE OR REPLACE FUNCTION public.support_canonical_category(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN 'Other'
    WHEN p ILIKE 'technical%' THEN 'Technical Issue'
    WHEN p ILIKE 'billing%' THEN 'Billing'
    WHEN p ILIKE 'feature%' THEN 'Feature Request'
    WHEN p ILIKE 'website%' OR p ILIKE 'web edit%' THEN 'Website Edits'
    WHEN p ILIKE 'account access%' OR p ILIKE 'login%' THEN 'Account Access'
    ELSE 'Other' END;
$$;

-- Picks the default assignee for a new chat/ticket. NULL = leave unassigned (owner default routing).
CREATE OR REPLACE FUNCTION public.support_pick_assignee(p_agency_id text, p_customer text, p_category text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; s record; v text; aid text := regexp_replace(coalesce(p_agency_id,''), 'NO$', '', 'i');
  members text[]; n int; i int; cat text;
BEGIN
  SELECT * INTO u FROM public.saas_suite_users x WHERE aid IN (x.agency_id, x.agency_id_basic, x.agency_id_advanced, x.agency_id_elite) LIMIT 1;
  IF u IS NULL OR u.human_chat_mode = 'managed' THEN RETURN NULL; END IF;

  -- Same customer keeps the same rep across chats and tickets.
  IF p_customer IS NOT NULL AND btrim(p_customer) <> '' THEN
    SELECT lower(a.assigned_to_email) INTO v FROM public.support_chat_assignments a
      WHERE a.agency_id = p_agency_id AND lower(btrim(a.user_identifier)) = lower(btrim(p_customer)) AND a.assigned_to_email IS NOT NULL LIMIT 1;
    IF v IS NULL THEN
      SELECT lower(t.assigned_to) INTO v FROM public.support_tickets t
        WHERE t.agency_id = p_agency_id AND lower(btrim(t.customer_email)) = lower(btrim(p_customer))
          AND t.assigned_to IS NOT NULL AND coalesce(t.status,'') NOT IN ('closed','resolved')
        ORDER BY t.created_at DESC LIMIT 1;
    END IF;
    IF v IS NOT NULL AND public.support_is_team_member(u.email, v) THEN RETURN v; END IF;
    v := NULL;
  END IF;

  SELECT * INTO s FROM public.support_assignment_settings WHERE owner_email = lower(u.email) FOR UPDATE;

  IF s IS NULL OR s.mode = 'category' THEN
    IF p_category IS NOT NULL THEN
      cat := public.support_canonical_category(p_category);
      SELECT lower(assign_to_email) INTO v FROM public.support_ticket_assign_rules
        WHERE agency_id = p_agency_id AND (lower(issue_category) = lower(p_category) OR lower(issue_category) = lower(cat)) LIMIT 1;
      IF v IS NULL THEN
        SELECT lower(assign_to_email) INTO v FROM public.support_ticket_assign_rules WHERE agency_id = p_agency_id AND issue_category = '*' LIMIT 1;
      END IF;
    END IF;
    IF v IS NULL AND s IS NOT NULL THEN v := s.fallback_email; END IF;
  ELSIF s.mode = 'person' THEN
    v := s.person_email;
  ELSIF s.mode = 'round_robin' THEN
    members := ARRAY(SELECT m FROM unnest(s.rr_members) WITH ORDINALITY t(m, o)
                     WHERE public.support_is_team_member(u.email, m) ORDER BY o);
    n := cardinality(members);
    IF n > 0 THEN
      i := (s.rr_cursor % n) + 1;
      v := members[i];
      UPDATE public.support_assignment_settings SET rr_cursor = i WHERE owner_email = s.owner_email;
    END IF;
  END IF;

  IF v IS NULL OR NOT public.support_is_team_member(u.email, v) THEN RETURN NULL; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.support_pick_assignee(text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_ticket_assign_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    BEGIN
      v_email := public.support_pick_assignee(NEW.agency_id, NEW.customer_email, coalesce(NEW.issue_category, 'Other'));
    EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
    IF v_email IS NOT NULL THEN
      NEW.assigned_to := v_email;
      NEW.assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- New chats: assign on the customer's first message if nobody is assigned yet.
CREATE OR REPLACE FUNCTION public.trg_auto_assign_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF NEW.role <> 'user' OR coalesce(NEW.user_identifier,'') = '' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.support_chat_assignments a WHERE a.agency_id = NEW.agency_id
             AND lower(a.user_identifier) = lower(NEW.user_identifier)) THEN RETURN NEW; END IF;
  BEGIN
    v_email := public.support_pick_assignee(NEW.agency_id, NEW.user_identifier, NULL);
    IF v_email IS NOT NULL THEN
      INSERT INTO public.support_chat_assignments (agency_id, user_identifier, assigned_to_email, assigned_by)
      VALUES (NEW.agency_id, NEW.user_identifier, v_email, 'auto-assign')
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
-- Name sorts before trg_chat_message_assignee_notify so the message alert sees the new assignee.
CREATE TRIGGER trg_aa_auto_assign_chat AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_assign_chat();

-- Keep We Handle & Respond in sync with plan changes.
CREATE OR REPLACE FUNCTION public.sync_chat_mode_with_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF upper(coalesce(NEW.plan::text,'')) IS DISTINCT FROM upper(coalesce(OLD.plan::text,'')) THEN
    IF upper(coalesce(NEW.plan::text,'')) = 'ADVANCED' THEN NEW.human_chat_mode := 'managed';
    ELSIF NEW.human_chat_mode = 'managed' THEN NEW.human_chat_mode := 'self';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_aa_sync_chat_mode_with_plan BEFORE UPDATE OF plan ON public.saas_suite_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_chat_mode_with_plan();

CREATE OR REPLACE FUNCTION public.set_chat_mode_default_for_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF upper(coalesce(NEW.plan::text,'')) = 'ADVANCED' AND coalesce(NEW.human_chat_mode,'self') = 'self' THEN
    NEW.human_chat_mode := 'managed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_aa_chat_mode_default_insert BEFORE INSERT ON public.saas_suite_users
  FOR EACH ROW EXECUTE FUNCTION public.set_chat_mode_default_for_plan();

-- Notification settings for whoever is signed in, scoped to the account on screen.
CREATE OR REPLACE FUNCTION public.get_support_notification_settings(p_owner_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE caller text := public.current_auth_email(); owner text := lower(btrim(p_owner_email));
  u record; prefs jsonb; role text; ids text[]; m record;
BEGIN
  IF caller = '' OR NOT public.can_access_owner_email(owner) THEN RETURN NULL; END IF;
  SELECT * INTO u FROM public.saas_suite_users WHERE lower(email) = owner LIMIT 1;
  IF u IS NULL THEN RETURN NULL; END IF;
  IF caller = owner OR NOT EXISTS (SELECT 1 FROM public.account_admins a WHERE lower(a.owner_email) = owner AND lower(a.admin_email) = caller AND a.status='accepted') THEN
    role := CASE WHEN caller = owner THEN 'owner' ELSE 'platform' END;
    prefs := u.support_email_alerts;
  ELSE
    role := 'admin';
    SELECT support_email_alerts INTO prefs FROM public.account_admins WHERE lower(owner_email) = owner AND lower(admin_email) = caller AND status='accepted' LIMIT 1;
  END IF;
  ids := ARRAY(SELECT x FROM unnest(ARRAY[u.agency_id,u.agency_id_basic,u.agency_id_advanced,u.agency_id_elite]) x WHERE x IS NOT NULL AND x <> '');
  SELECT * INTO m FROM public.slack_channel_agency_map WHERE agency_id = ANY(ids) AND is_active AND bot_token IS NOT NULL
    ORDER BY installed_at DESC NULLS LAST LIMIT 1;
  RETURN jsonb_build_object('role', role, 'mode', coalesce(u.human_chat_mode,'self'), 'plan', u.plan,
    'email', coalesce(prefs,'{}'::jsonb),
    'slack', CASE WHEN m IS NULL THEN jsonb_build_object('connected', false) ELSE jsonb_build_object('connected', true,
      'alert_assigned_chat', m.alert_assigned_chat, 'alert_assigned_ticket', m.alert_assigned_ticket,
      'alert_assigned_updates', m.alert_assigned_updates, 'alert_new_unassigned_chats', m.alert_new_unassigned_chats,
      'alert_new_unassigned_tickets', m.alert_new_unassigned_tickets) END);
END $$;

CREATE OR REPLACE FUNCTION public.set_support_email_alert_pref_for(p_owner_email text, p_key text, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller text := public.current_auth_email(); owner text := lower(btrim(p_owner_email));
BEGIN
  IF caller = '' OR NOT public.can_access_owner_email(owner) THEN RETURN false; END IF;
  IF p_key NOT IN ('alert_assigned_chat','alert_assigned_ticket','alert_assigned_updates','alert_new_unassigned_chats','alert_new_unassigned_tickets') THEN RETURN false; END IF;
  IF caller <> owner AND EXISTS (SELECT 1 FROM public.account_admins a WHERE lower(a.owner_email) = owner AND lower(a.admin_email) = caller AND a.status='accepted') THEN
    UPDATE public.account_admins SET support_email_alerts = jsonb_set(coalesce(support_email_alerts,'{}'::jsonb), array[p_key], to_jsonb(p_enabled), true)
      WHERE lower(owner_email) = owner AND lower(admin_email) = caller AND status='accepted';
  ELSE
    UPDATE public.saas_suite_users SET support_email_alerts = jsonb_set(coalesce(support_email_alerts,'{}'::jsonb), array[p_key], to_jsonb(p_enabled), true)
      WHERE lower(email) = owner;
  END IF;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.get_support_notification_settings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_support_email_alert_pref_for(text,text,boolean) TO authenticated;