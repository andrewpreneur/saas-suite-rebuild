CREATE OR REPLACE FUNCTION public.log_ticket_team_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.admin_response IS NOT NULL AND length(trim(NEW.admin_response)) > 0
     AND (TG_OP = 'INSERT' OR NEW.admin_response IS DISTINCT FROM OLD.admin_response) THEN
    INSERT INTO public.support_ticket_replies (ticket_id, sender_role, sender_name, sender_email, body, created_at)
    VALUES (NEW.id, 'admin', 'SaaS Suite', NEW.responded_by, NEW.admin_response, coalesce(NEW.responded_at, now()));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_ticket_team_response ON public.support_tickets;
CREATE TRIGGER trg_log_ticket_team_response AFTER INSERT OR UPDATE OF admin_response ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_team_response();

INSERT INTO public.support_ticket_replies (ticket_id, sender_role, sender_name, sender_email, body, created_at)
SELECT t.id, 'admin', 'SaaS Suite', t.responded_by, t.admin_response, coalesce(t.responded_at, t.updated_at, t.created_at)
FROM public.support_tickets t
WHERE t.admin_response IS NOT NULL AND length(trim(t.admin_response)) > 0
  AND NOT EXISTS (SELECT 1 FROM public.support_ticket_replies r WHERE r.ticket_id = t.id AND r.sender_role = 'admin' AND r.body = t.admin_response);