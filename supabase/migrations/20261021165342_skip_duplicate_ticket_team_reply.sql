-- One POST /tickets/reply was storing two support_ticket_replies rows.
-- admin-support-api inserts the reply, then updates support_tickets.admin_response.
-- trg_log_ticket_team_response inserts again on that update, with sender_email =
-- responded_by ('api' when the caller omits an email) and created_at = the
-- JavaScript responded_at. Portal replies only update the ticket, so this
-- trigger still has to log those.
-- Skip when a team reply with this body was already written after the previous
-- responded_at — that is the row the API just inserted and returns.

CREATE OR REPLACE FUNCTION public.log_ticket_team_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.admin_response IS NOT NULL AND length(trim(NEW.admin_response)) > 0
     AND (TG_OP = 'INSERT' OR NEW.admin_response IS DISTINCT FROM OLD.admin_response) THEN
    -- PL/pgSQL AND short-circuits, but OLD is unassigned on INSERT.
    -- Only the UPDATE path looks for the reply the API already stored.
    IF TG_OP = 'UPDATE' THEN
      IF EXISTS (
        SELECT 1
        FROM public.support_ticket_replies r
        WHERE r.ticket_id = NEW.id
          AND r.sender_role IS DISTINCT FROM 'customer'
          AND r.body = NEW.admin_response
          AND r.created_at > COALESCE(OLD.responded_at, '-infinity'::timestamptz)
      ) THEN
        RETURN NEW;
      END IF;
    END IF;

    INSERT INTO public.support_ticket_replies (ticket_id, sender_role, sender_name, sender_email, body, created_at)
    VALUES (NEW.id, 'admin', 'SaaS Suite', NEW.responded_by, NEW.admin_response, coalesce(NEW.responded_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_ticket_team_response() FROM PUBLIC, anon, authenticated;
