-- A portal team reply and an existing customer reply can share one clock
-- tick. created_at then ties, and ordering by id can show the team reply
-- first. Keep responded_at when it is already later, and otherwise place the
-- team reply one microsecond after the latest row on that ticket.

CREATE OR REPLACE FUNCTION public.log_ticket_team_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_created timestamptz;
  v_latest timestamptz;
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

    v_created := coalesce(NEW.responded_at, now());
    SELECT max(r.created_at) INTO v_latest
    FROM public.support_ticket_replies r
    WHERE r.ticket_id = NEW.id;
    IF v_latest IS NOT NULL AND v_created <= v_latest THEN
      v_created := v_latest + interval '1 microsecond';
    END IF;

    INSERT INTO public.support_ticket_replies (ticket_id, sender_role, sender_name, sender_email, body, created_at)
    VALUES (NEW.id, 'admin', 'SaaS Suite', NEW.responded_by, NEW.admin_response, v_created);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_ticket_team_response() FROM PUBLIC, anon, authenticated;
