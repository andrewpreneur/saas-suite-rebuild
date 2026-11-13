ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS ai_chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_chat_mode text NOT NULL DEFAULT 'self';

UPDATE public.saas_suite_users SET ai_chat_enabled = coalesce(show_chat_widget, true), human_chat_enabled = coalesce(show_chat_widget, true);

CREATE OR REPLACE FUNCTION public.guard_chat_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.human_chat_mode NOT IN ('self','managed') THEN
    RAISE EXCEPTION 'human_chat_mode must be self or managed';
  END IF;
  IF NEW.human_chat_mode = 'managed' AND upper(coalesce(NEW.plan::text,'')) <> 'ADVANCED' THEN
    IF TG_OP = 'INSERT' OR OLD.human_chat_mode IS DISTINCT FROM 'managed' THEN
      RAISE EXCEPTION 'We Handle & Respond is only available on the Advanced plan';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.ai_chat_enabled IS DISTINCT FROM OLD.ai_chat_enabled OR NEW.human_chat_enabled IS DISTINCT FROM OLD.human_chat_enabled THEN
    NEW.show_chat_widget := NEW.ai_chat_enabled OR NEW.human_chat_enabled;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_chat_mode ON public.saas_suite_users;
CREATE TRIGGER trg_guard_chat_mode BEFORE INSERT OR UPDATE ON public.saas_suite_users
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_mode();

ALTER TABLE public.slack_channel_agency_map
  ADD COLUMN IF NOT EXISTS alert_assigned_chat boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_assigned_ticket boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_assigned_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_new_unassigned_chats boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_new_unassigned_tickets boolean NOT NULL DEFAULT true;

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_by text;

CREATE OR REPLACE FUNCTION public.stamp_ticket_assigned_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_by IS NOT DISTINCT FROM OLD.assigned_by THEN
      NEW.assigned_by := public.current_auth_email();
    END IF;
    IF NEW.assigned_to IS NULL THEN NEW.assigned_by := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_stamp_ticket_assigned_by ON public.support_tickets;
CREATE TRIGGER trg_stamp_ticket_assigned_by BEFORE UPDATE OF assigned_to ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.stamp_ticket_assigned_by();

-- Public chat config lookup for the chat widget (no personal data).
CREATE OR REPLACE FUNCTION public.get_agency_chat_config(p_agency_id text)
RETURNS TABLE(ai_chat_enabled boolean, human_chat_enabled boolean, human_chat_mode text, support_ticketing_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.ai_chat_enabled, u.human_chat_enabled, u.human_chat_mode, coalesce(u.support_ticketing_enabled,false)
  FROM public.saas_suite_users u
  WHERE regexp_replace(p_agency_id, 'NO$', '', 'i') IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_agency_chat_config(text) TO anon, authenticated, service_role;

-- Server-only: who should be alerted for a chat (assignee, or owner when agency handles it).
CREATE OR REPLACE FUNCTION public.get_support_alert_context(p_agency_id text, p_user_identifier text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; a text; n text; ph text; r text; aid text := regexp_replace(p_agency_id, 'NO$', '', 'i');
BEGIN
  SELECT * INTO u FROM public.saas_suite_users s WHERE aid IN (s.agency_id, s.agency_id_basic, s.agency_id_advanced, s.agency_id_elite) LIMIT 1;
  IF u IS NULL THEN RETURN NULL; END IF;
  SELECT lower(assigned_to_email) INTO a FROM public.support_chat_assignments
    WHERE agency_id = aid AND lower(btrim(user_identifier)) = lower(btrim(p_user_identifier)) LIMIT 1;
  IF a IS NOT NULL THEN
    r := 'assignee';
    SELECT coalesce(nullif(admin_name,''), admin_email), admin_phone INTO n, ph FROM public.account_admins
      WHERE lower(admin_email) = a AND lower(owner_email) = lower(u.email) LIMIT 1;
    IF n IS NULL AND a = lower(u.email) THEN n := u.full_name; ph := u.bonuses_phone; END IF;
  ELSIF u.human_chat_mode = 'self' THEN
    r := 'owner_default'; a := lower(u.email); n := u.full_name; ph := u.bonuses_phone;
  ELSE
    r := 'saassuite';
  END IF;
  RETURN jsonb_build_object(
    'human_chat_mode', u.human_chat_mode, 'handled_by', CASE WHEN u.human_chat_mode='managed' THEN 'saassuite' ELSE 'agency' END,
    'ai_chat_enabled', u.ai_chat_enabled, 'human_chat_enabled', u.human_chat_enabled,
    'notify_target', r, 'assigned_to_email', a, 'assigned_to_name', n, 'assigned_to_phone', ph,
    'assigned_default', r = 'owner_default',
    'account_owner_name', u.full_name, 'account_owner_email', lower(u.email), 'account_owner_phone', u.bonuses_phone,
    'account_name', u.agency_name, 'plan', u.plan);
END $$;
REVOKE ALL ON FUNCTION public.get_support_alert_context(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_alert_context(text, text) TO service_role;

-- Slack alert prefs for the Support screen.
CREATE OR REPLACE FUNCTION public.get_slack_support_alert_prefs(user_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ids text[]; m record;
BEGIN
  IF NOT public.can_access_owner_email(user_email) THEN RETURN NULL; END IF;
  SELECT ARRAY(SELECT x FROM (SELECT unnest(ARRAY[u.agency_id,u.agency_id_basic,u.agency_id_advanced,u.agency_id_elite]) x
    FROM public.saas_suite_users u WHERE lower(trim(u.email)) = lower(trim(user_email))) s WHERE x IS NOT NULL AND x <> '') INTO ids;
  SELECT * INTO m FROM public.slack_channel_agency_map WHERE agency_id = ANY(ids) AND is_active AND bot_token IS NOT NULL
    ORDER BY installed_at DESC NULLS LAST LIMIT 1;
  IF m IS NULL THEN RETURN jsonb_build_object('connected', false); END IF;
  RETURN jsonb_build_object('connected', true,
    'alert_assigned_chat', m.alert_assigned_chat, 'alert_assigned_ticket', m.alert_assigned_ticket,
    'alert_assigned_updates', m.alert_assigned_updates, 'alert_new_unassigned_chats', m.alert_new_unassigned_chats,
    'alert_new_unassigned_tickets', m.alert_new_unassigned_tickets);
END $$;
GRANT EXECUTE ON FUNCTION public.get_slack_support_alert_prefs(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_slack_support_alert_pref(user_email text, p_key text, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids text[];
BEGIN
  IF NOT public.can_access_owner_email(user_email) THEN RETURN false; END IF;
  IF p_key NOT IN ('alert_assigned_chat','alert_assigned_ticket','alert_assigned_updates','alert_new_unassigned_chats','alert_new_unassigned_tickets') THEN RETURN false; END IF;
  SELECT ARRAY(SELECT x FROM (SELECT unnest(ARRAY[u.agency_id,u.agency_id_basic,u.agency_id_advanced,u.agency_id_elite]) x
    FROM public.saas_suite_users u WHERE lower(trim(u.email)) = lower(trim(user_email))) s WHERE x IS NOT NULL AND x <> '') INTO ids;
  EXECUTE format('UPDATE public.slack_channel_agency_map SET %I = $1, updated_at = now() WHERE agency_id = ANY($2) AND is_active', p_key)
    USING p_enabled, ids;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.set_slack_support_alert_pref(text, text, boolean) TO authenticated;

-- Slack: chat assignment + activity on assigned items.
CREATE OR REPLACE FUNCTION public.trg_chat_assignment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.assigned_to_email IS NOT DISTINCT FROM OLD.assigned_to_email THEN RETURN NEW; END IF;
  IF NEW.assigned_to_email IS NOT NULL THEN
    SELECT coalesce(nullif(aa.admin_name, ''), aa.admin_email) INTO v_name FROM public.account_admins aa
      WHERE lower(aa.admin_email) = lower(NEW.assigned_to_email) LIMIT 1;
    IF v_name IS NULL THEN
      SELECT coalesce(nullif(u.full_name, ''), u.email) INTO v_name FROM public.saas_suite_users u
        WHERE lower(u.email) = lower(NEW.assigned_to_email) LIMIT 1;
    END IF;
  END IF;
  UPDATE public.chat_threads t SET assigned_to_email = lower(NEW.assigned_to_email),
    assigned_to_name = CASE WHEN NEW.assigned_to_email IS NULL THEN NULL ELSE coalesce(v_name, NEW.assigned_to_email) END,
    assigned_at = CASE WHEN NEW.assigned_to_email IS NULL THEN NULL ELSE now() END
  WHERE t.agency_id = NEW.agency_id AND lower(btrim(t.user_identifier)) = lower(btrim(NEW.user_identifier));
  IF NEW.assigned_to_email IS NOT NULL THEN
    PERFORM public._support_assignee_dispatch('chat_assigned',
      jsonb_build_object('agency_id', NEW.agency_id, 'user_identifier', NEW.user_identifier));
    PERFORM public._slack_auto_dispatch(NEW.agency_id, 'chat_assigned', jsonb_build_object(
      'user_email', NEW.user_identifier, 'user_name', NEW.user_identifier,
      'assigned_to', coalesce(v_name, NEW.assigned_to_email), 'assigned_by', coalesce(NEW.assigned_by, '')));
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_chat_message_assignee_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_assigned text;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  SELECT a.assigned_to_email INTO v_assigned FROM public.support_chat_assignments a
    WHERE a.agency_id = NEW.agency_id AND lower(btrim(a.user_identifier)) = lower(btrim(NEW.user_identifier))
      AND a.assigned_to_email IS NOT NULL LIMIT 1;
  IF v_assigned IS NOT NULL OR EXISTS (SELECT 1 FROM public.saas_suite_users u WHERE u.notify_all_chats
        AND NEW.agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)) THEN
    PERFORM public._support_assignee_dispatch('chat_message',
      jsonb_build_object('agency_id', NEW.agency_id, 'user_identifier', NEW.user_identifier, 'message_id', NEW.id));
  END IF;
  IF v_assigned IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ai_chat_messages m
      WHERE m.agency_id = NEW.agency_id AND m.user_identifier = NEW.user_identifier AND m.role = 'user'
        AND m.id <> NEW.id AND m.created_at > NEW.created_at - interval '10 minutes') THEN
    PERFORM public._slack_auto_dispatch(NEW.agency_id, 'assigned_chat_message', jsonb_build_object(
      'user_email', NEW.user_identifier, 'user_name', NEW.user_identifier,
      'assigned_to', v_assigned, 'message', LEFT(coalesce(NEW.content,''), 500)));
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_support_reply_assignee_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE t record;
BEGIN
  IF NEW.sender_role = 'customer' THEN
    PERFORM public._support_assignee_dispatch('ticket_message', jsonb_build_object('ticket_id', NEW.ticket_id, 'reply_id', NEW.id));
    SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
    IF t.assigned_to IS NOT NULL THEN
      PERFORM public._slack_auto_dispatch(t.agency_id, 'assigned_ticket_reply', jsonb_build_object(
        'ticket_id', t.ticket_number, 'subject', coalesce(t.issue_category,''),
        'user_email', t.customer_email, 'user_name', t.customer_name,
        'assigned_to', t.assigned_to, 'message', LEFT(coalesce(NEW.body,''), 800)));
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.notify_slack_ticket_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $function$
DECLARE status_changed boolean; response_changed boolean;
BEGIN
  status_changed   := (NEW.status IS DISTINCT FROM OLD.status);
  response_changed := (COALESCE(NEW.admin_response,'') IS DISTINCT FROM COALESCE(OLD.admin_response,''));
  IF NOT status_changed AND NOT response_changed THEN RETURN NEW; END IF;
  PERFORM public._slack_auto_dispatch(NEW.agency_id, 'ticket_updated', jsonb_build_object(
      'ticket_id', NEW.ticket_number, 'subject', COALESCE(NEW.issue_category, ''),
      'user_email', NEW.customer_email, 'user_name', NEW.customer_name,
      'previous_status', OLD.status, 'status', NEW.status,
      'updated_by', COALESCE(NEW.responded_by_name, NEW.responded_by, ''),
      'assigned_to', COALESCE(NEW.assigned_to, ''),
      'note', CASE WHEN response_changed THEN LEFT(COALESCE(NEW.admin_response, ''), 800) ELSE '' END));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_slack_ticket_updated failed: %', SQLERRM; RETURN NEW;
END $function$;