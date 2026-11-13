ALTER TABLE public.account_admins
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS restrict_assigned_chats boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restrict_assigned_tickets boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_assigned_tickets boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_assigned_chats boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_phone text;

ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS notify_all_tickets boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_all_chats boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_assigned_tickets boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_autopay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_autopay_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS onboarding_stripe_payment_method_id text;

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS responded_by_name text;
ALTER TABLE public.agency_owner_messages
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_email text;
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS assigned_to_email text,
  ADD COLUMN IF NOT EXISTS assigned_to_name text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE public.onboarding_calls
  ADD COLUMN IF NOT EXISTS charge_status text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Only the owner (or platform admin / server) can change an admin's visibility.
CREATE OR REPLACE FUNCTION public.guard_account_admin_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.permissions IS DISTINCT FROM OLD.permissions
      OR NEW.restrict_assigned_chats IS DISTINCT FROM OLD.restrict_assigned_chats
      OR NEW.restrict_assigned_tickets IS DISTINCT FROM OLD.restrict_assigned_tickets)
     AND NOT public.is_platform_admin()
     AND coalesce(auth.role(), '') <> 'service_role'
     AND lower(OLD.owner_email) <> public.current_auth_email() THEN
    RAISE EXCEPTION 'Only the account owner can change admin permissions';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_account_admin_permissions ON public.account_admins;
CREATE TRIGGER trg_guard_account_admin_permissions BEFORE UPDATE ON public.account_admins
FOR EACH ROW EXECUTE FUNCTION public.guard_account_admin_permissions();

-- Card/autopay fields are server-managed; clients may only switch autopay off.
CREATE OR REPLACE FUNCTION public.guard_onboarding_autopay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.onboarding_stripe_customer_id IS DISTINCT FROM OLD.onboarding_stripe_customer_id
     OR NEW.onboarding_stripe_payment_method_id IS DISTINCT FROM OLD.onboarding_stripe_payment_method_id
     OR NEW.onboarding_autopay_consent_at IS DISTINCT FROM OLD.onboarding_autopay_consent_at
     OR (NEW.onboarding_autopay AND NOT OLD.onboarding_autopay) THEN
    RAISE EXCEPTION 'Auto-pay can only be enabled through card setup';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_onboarding_autopay ON public.saas_suite_users;
CREATE TRIGGER trg_guard_onboarding_autopay BEFORE UPDATE ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.guard_onboarding_autopay();

-- The admin row (if the caller is an added admin, not the owner) for an agency.
CREATE OR REPLACE FUNCTION public.support_admin_row(p_agency_id text)
RETURNS public.account_admins LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT aa.* FROM public.account_admins aa
  JOIN public.saas_suite_users ssu ON lower(ssu.email) = lower(aa.owner_email)
  WHERE lower(aa.admin_email) = public.current_auth_email()
    AND aa.status = 'accepted'
    AND lower(aa.owner_email) <> public.current_auth_email()
    AND p_agency_id IN (ssu.agency_id, ssu.agency_id_basic, ssu.agency_id_advanced, ssu.agency_id_elite,
      ssu.original_agency_id, ssu.original_agency_id_basic, ssu.original_agency_id_advanced,
      ssu.original_agency_id_elite, ssu.agency_name)
    AND NOT EXISTS (
      SELECT 1 FROM public.saas_suite_users o
      WHERE lower(o.email) = public.current_auth_email()
        AND p_agency_id IN (o.agency_id, o.agency_id_basic, o.agency_id_advanced, o.agency_id_elite,
          o.original_agency_id, o.original_agency_id_basic, o.original_agency_id_advanced,
          o.original_agency_id_elite, o.agency_name))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.support_can_see_ticket(p_agency_id text, p_assigned_to text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.account_admins;
BEGIN
  IF public.is_platform_admin() THEN RETURN true; END IF;
  r := public.support_admin_row(p_agency_id);
  IF r.id IS NULL THEN RETURN true; END IF;
  IF coalesce(r.permissions->>'support_tickets', 'edit') = 'none' THEN RETURN false; END IF;
  IF r.restrict_assigned_tickets AND lower(coalesce(p_assigned_to, '')) <> public.current_auth_email() THEN RETURN false; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.support_can_edit_ticket(p_agency_id text, p_assigned_to text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.account_admins;
BEGIN
  IF public.is_platform_admin() THEN RETURN true; END IF;
  r := public.support_admin_row(p_agency_id);
  IF r.id IS NULL THEN RETURN true; END IF;
  IF coalesce(r.permissions->>'support_tickets', 'edit') <> 'edit' THEN RETURN false; END IF;
  IF r.restrict_assigned_tickets AND lower(coalesce(p_assigned_to, '')) <> public.current_auth_email() THEN RETURN false; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.support_can_see_chat(p_agency_id text, p_user_identifier text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.account_admins;
BEGIN
  IF public.is_platform_admin() THEN RETURN true; END IF;
  r := public.support_admin_row(p_agency_id);
  IF r.id IS NULL THEN RETURN true; END IF;
  IF coalesce(r.permissions->>'support_chats', 'edit') = 'none' THEN RETURN false; END IF;
  IF r.restrict_assigned_chats THEN
    RETURN EXISTS (SELECT 1 FROM public.support_chat_assignments a
      WHERE a.agency_id = p_agency_id
        AND lower(btrim(a.user_identifier)) = lower(btrim(coalesce(p_user_identifier, '')))
        AND lower(coalesce(a.assigned_to_email, '')) = public.current_auth_email());
  END IF;
  RETURN true;
END $$;

DROP POLICY IF EXISTS "Agency owners can view support tickets" ON public.support_tickets;
CREATE POLICY "Agency owners can view support tickets" ON public.support_tickets FOR SELECT
USING ((public.can_access_agency(agency_id) AND public.support_can_see_ticket(agency_id, assigned_to))
       OR lower(customer_email) = public.current_auth_email());
DROP POLICY IF EXISTS "Agency owners can update support tickets" ON public.support_tickets;
CREATE POLICY "Agency owners can update support tickets" ON public.support_tickets FOR UPDATE
USING (public.can_access_agency(agency_id) AND public.support_can_edit_ticket(agency_id, assigned_to))
WITH CHECK (public.can_access_agency(agency_id));

DROP POLICY IF EXISTS "Agency owners can read chat threads" ON public.chat_threads;
CREATE POLICY "Agency owners can read chat threads" ON public.chat_threads FOR SELECT
USING (public.can_access_agency(agency_id) AND public.support_can_see_chat(agency_id, user_identifier));

DROP POLICY IF EXISTS "Agency owners can view ai chat messages" ON public.ai_chat_messages;
CREATE POLICY "Agency owners can view ai chat messages" ON public.ai_chat_messages FOR SELECT
USING ((public.can_access_agency(agency_id) AND public.support_can_see_chat(agency_id, user_identifier))
       OR lower(user_identifier) = public.current_auth_email());

CREATE OR REPLACE FUNCTION public.get_agency_tickets(user_email text)
 RETURNS TABLE(id uuid, ticket_number integer, agency_id text, customer_name text, customer_email text, issue_category text, request_text text, status text, created_at timestamp with time zone, admin_response text, responded_at timestamp with time zone, admin_response_attachment_url text, attachment_url text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE user_agency_ids text[];
BEGIN
  SELECT ARRAY_REMOVE(ARRAY[ssu.agency_id, ssu.agency_id_basic, ssu.agency_id_advanced, ssu.agency_id_elite,
    ssu.original_agency_id, ssu.original_agency_id_basic, ssu.original_agency_id_advanced,
    ssu.original_agency_id_elite, ssu.agency_name], NULL) INTO user_agency_ids
  FROM saas_suite_users ssu WHERE ssu.email = user_email;

  RETURN QUERY
  SELECT st.id, st.ticket_number, st.agency_id, st.customer_name, st.customer_email, st.issue_category,
    st.request_text, st.status, st.created_at, st.admin_response, st.responded_at,
    st.admin_response_attachment_url, st.attachment_url
  FROM support_tickets st
  WHERE st.agency_id = ANY(user_agency_ids)
    AND public.support_can_see_ticket(st.agency_id, st.assigned_to)
  ORDER BY st.created_at DESC;
END;
$function$;

-- Lets the hub AI chat know who is handling a conversation.
CREATE OR REPLACE FUNCTION public.get_chat_assignment(p_agency_id text, p_user_identifier text)
RETURNS TABLE(assigned_to_name text, assigned_to_email text, assigned_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.assigned_to_name, t.assigned_to_email, t.assigned_at FROM public.chat_threads t
  WHERE lower(btrim(t.agency_id)) = lower(btrim(p_agency_id))
    AND lower(btrim(t.user_identifier)) = lower(btrim(p_user_identifier))
    AND t.assigned_to_email IS NOT NULL
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_chat_assignment(text, text) TO anon, authenticated;

-- Dispatch to the assignee-notification edge function.
CREATE OR REPLACE FUNCTION public._support_assignee_dispatch(_event text, _data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-support-assignee',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('event', _event, 'data', _data));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_support_assignee_dispatch failed: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.trg_support_ticket_assignee_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._support_assignee_dispatch('ticket_created', jsonb_build_object('ticket_id', NEW.id));
  ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public._support_assignee_dispatch('ticket_assigned', jsonb_build_object('ticket_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_ticket_assignee_notify ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_assignee_notify AFTER INSERT OR UPDATE OF assigned_to ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_support_ticket_assignee_notify();

CREATE OR REPLACE FUNCTION public.trg_support_reply_assignee_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_role = 'customer' THEN
    PERFORM public._support_assignee_dispatch('ticket_message', jsonb_build_object('ticket_id', NEW.ticket_id, 'reply_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_reply_assignee_notify ON public.support_ticket_replies;
CREATE TRIGGER trg_support_reply_assignee_notify AFTER INSERT ON public.support_ticket_replies
FOR EACH ROW EXECUTE FUNCTION public.trg_support_reply_assignee_notify();

CREATE OR REPLACE FUNCTION public.trg_chat_assignment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chat_assignment_sync ON public.support_chat_assignments;
CREATE TRIGGER trg_chat_assignment_sync AFTER INSERT OR UPDATE ON public.support_chat_assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_chat_assignment_sync();

CREATE OR REPLACE FUNCTION public.trg_chat_message_assignee_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.support_chat_assignments a
      WHERE a.agency_id = NEW.agency_id AND lower(btrim(a.user_identifier)) = lower(btrim(NEW.user_identifier))
        AND a.assigned_to_email IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.saas_suite_users u WHERE u.notify_all_chats
        AND NEW.agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)) THEN
    PERFORM public._support_assignee_dispatch('chat_message',
      jsonb_build_object('agency_id', NEW.agency_id, 'user_identifier', NEW.user_identifier, 'message_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chat_message_assignee_notify ON public.ai_chat_messages;
CREATE TRIGGER trg_chat_message_assignee_notify AFTER INSERT ON public.ai_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_chat_message_assignee_notify();

-- Wider onboarding-call owner lookup: account email, team admin email, client email, then name.
CREATE OR REPLACE FUNCTION public.find_onboarding_owner(_email text, _name text DEFAULT NULL)
RETURNS TABLE(owner_email text, owner_name text, agency_id text, matched_by text,
  onboarding_autopay boolean, stripe_customer_id text, stripe_payment_method_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := nullif(lower(btrim(coalesce(_email, ''))), '');
        n text := nullif(lower(btrim(coalesce(_name, ''))), '');
        v_owner text; v_by text;
BEGIN
  IF e IS NOT NULL THEN
    SELECT u.email INTO v_owner FROM saas_suite_users u WHERE lower(btrim(u.email)) = e LIMIT 1;
    IF v_owner IS NOT NULL THEN v_by := 'email'; END IF;
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
    SELECT u.email INTO v_owner FROM saas_suite_users u WHERE lower(btrim(coalesce(u.full_name, ''))) = n LIMIT 1;
    IF v_owner IS NOT NULL THEN v_by := 'name'; END IF;
  END IF;
  IF v_owner IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT lower(u.email), u.full_name,
    COALESCE(u.agency_id_advanced, u.agency_id_elite, u.agency_id_basic, u.agency_id), v_by,
    u.onboarding_autopay, u.onboarding_stripe_customer_id, u.onboarding_stripe_payment_method_id
  FROM saas_suite_users u WHERE lower(u.email) = lower(v_owner) LIMIT 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.find_onboarding_owner(text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.find_onboarding_owner(text, text) TO service_role;