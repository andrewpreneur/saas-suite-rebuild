-- Ticket reply lists were ordered only by created_at. Two rows written in the
-- same instant came back in either order, so the latest reply was not stable.
-- id is the tiebreak: created_at, then id.

CREATE OR REPLACE FUNCTION public.get_ticket_replies_for_staff(p_ticket_id uuid)
RETURNS TABLE(id uuid, sender_role text, sender_name text, sender_email text, body text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agency text;
BEGIN
  SELECT agency_id INTO v_agency FROM public.support_tickets WHERE support_tickets.id = p_ticket_id;
  IF v_agency IS NULL THEN RETURN; END IF;
  IF NOT (lower(coalesce(public.current_auth_email(),'')) = 'andrew@dna-media.net' OR public.can_access_agency(v_agency)) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT r.id, r.sender_role, r.sender_name, r.sender_email, r.body, r.created_at
  FROM public.support_ticket_replies r WHERE r.ticket_id = p_ticket_id ORDER BY r.created_at ASC, r.id ASC;
END; $$;

REVOKE ALL ON FUNCTION public.get_ticket_replies_for_staff(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_replies_for_staff(uuid) TO authenticated;
