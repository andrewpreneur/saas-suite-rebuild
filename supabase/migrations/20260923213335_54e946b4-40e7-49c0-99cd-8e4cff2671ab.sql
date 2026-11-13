CREATE TABLE public.support_ticket_assign_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  issue_category text NOT NULL,
  assign_to_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, issue_category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_assign_rules TO authenticated;
GRANT ALL ON public.support_ticket_assign_rules TO service_role;
ALTER TABLE public.support_ticket_assign_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency members manage assign rules" ON public.support_ticket_assign_rules
  FOR ALL TO authenticated
  USING (public.can_access_agency(agency_id))
  WITH CHECK (public.can_access_agency(agency_id));
CREATE TRIGGER trg_assign_rules_updated BEFORE UPDATE ON public.support_ticket_assign_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_user_tool_data_updated_at();

CREATE OR REPLACE FUNCTION public.apply_ticket_assign_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    SELECT assign_to_email INTO v_email FROM public.support_ticket_assign_rules
     WHERE agency_id = NEW.agency_id AND lower(issue_category) = lower(COALESCE(NEW.issue_category,''))
     LIMIT 1;
    IF v_email IS NULL THEN
      SELECT assign_to_email INTO v_email FROM public.support_ticket_assign_rules
       WHERE agency_id = NEW.agency_id AND issue_category = '*' LIMIT 1;
    END IF;
    IF v_email IS NOT NULL THEN
      NEW.assigned_to := v_email;
      NEW.assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_ticket_assign_rule BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_ticket_assign_rule();

CREATE OR REPLACE FUNCTION public.notify_slack_ticket_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM public._slack_auto_dispatch(NEW.agency_id, 'ticket_created', jsonb_build_object(
    'ticket_id', NEW.ticket_number, 'subject', COALESCE(NEW.issue_category,''),
    'user_email', NEW.customer_email, 'user_name', NEW.customer_name,
    'message', LEFT(COALESCE(NEW.request_text,''), 800), 'status', NEW.status,
    'assigned_to', COALESCE(NEW.assigned_to,'')));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_slack_ticket_created failed: %', SQLERRM; RETURN NEW;
END $$;
CREATE TRIGGER trg_slack_ticket_created AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_slack_ticket_created();

CREATE OR REPLACE FUNCTION public.notify_slack_ticket_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    PERFORM public._slack_auto_dispatch(NEW.agency_id, 'ticket_assigned', jsonb_build_object(
      'ticket_id', NEW.ticket_number, 'subject', COALESCE(NEW.issue_category,''),
      'user_email', NEW.customer_email, 'user_name', NEW.customer_name,
      'assigned_to', NEW.assigned_to, 'previous_assignee', COALESCE(OLD.assigned_to,'')));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_slack_ticket_assigned failed: %', SQLERRM; RETURN NEW;
END $$;
CREATE TRIGGER trg_slack_ticket_assigned AFTER UPDATE OF assigned_to ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_slack_ticket_assigned();