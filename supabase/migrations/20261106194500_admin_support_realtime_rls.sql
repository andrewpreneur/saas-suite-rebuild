-- /admin/support live updates.
--
-- Nov 1 (platform_admin_support_select) and Nov 5 (ai_chat_messages) SELECT
-- policies inlined the excluded-agency join. PostgREST can plan that join once
-- and the inbox loads. Supabase Realtime authorizes each INSERT/UPDATE with the
-- subscriber JWT and drops the event when that policy is a join across
-- platform_support_excluded_agencies and saas_suite_users (those tables have
-- their own RLS, and WALRUS does not apply the lateral join).
--
-- platform_support_excluded_agency_ids() already computes the same set, but
-- EXECUTE is service_role only, so policies cannot call it.
-- platform_support_excluded_keys() is that lookup as a zero-arg STABLE function:
-- one call per statement, not the old per-row is_platform_support_excluded scan.
-- Non-admins get an empty array, so the slug list is not an RPC directory.
-- Visibility is unchanged: excluded agencies stay out of the platform inbox,
-- blank ids stay visible, a ticket whose customer is the signed-in user stays
-- visible, and everyone else still goes through can_access_agency and
-- support_can_see_*.
--
-- Realtime's apply_rls runs anon before authenticated. anon has no EXECUTE on
-- platform_support_agency_key, so a public policy throws 42501 and aborts the
-- whole WAL batch before Andrew's session is checked. These four SELECT
-- policies are TO authenticated (anon never passes them; Client Hub reads go
-- through edge functions). agency_owner_messages keeps its existing public
-- SELECT policy. anon is still granted EXECUTE on platform_support_agency_key
-- so a leftover call cannot abort the batch.
--
-- Bare zero-arg STABLE calls inside CASE are not InitPlan'd. On 6005
-- ai_chat_messages that reran platform_support_excluded_keys() per row
-- (~27s, statement timeout 57014). Scalar subselects force InitPlan (once
-- per statement). current_auth_email() returns '' when absent, so email
-- matches use NULLIF(..., '') and do not treat a blank login as a blank
-- customer.
--
-- support_ticket_replies had RLS and no SELECT policy, so Realtime dropped
-- every customer reply. Staff and the ticket's customer can read a reply only
-- when they can read the parent ticket. ticket_id is uuid on live.

CREATE OR REPLACE FUNCTION public.platform_support_excluded_keys()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_platform_admin() THEN ARRAY[]::text[]
    ELSE COALESCE((
      SELECT array_agg(DISTINCT keys.agency_id)
      FROM public.platform_support_excluded_agencies ex
      JOIN public.saas_suite_users ssu
        ON lower(ssu.email) = ex.owner_email
      CROSS JOIN LATERAL (
        VALUES
          (public.platform_support_agency_key(ssu.agency_id)),
          (public.platform_support_agency_key(ssu.agency_id_basic)),
          (public.platform_support_agency_key(ssu.agency_id_advanced)),
          (public.platform_support_agency_key(ssu.agency_id_elite))
      ) AS keys(agency_id)
      WHERE keys.agency_id IS NOT NULL
    ), ARRAY[]::text[])
  END;
$$;

COMMENT ON FUNCTION public.platform_support_excluded_keys() IS
  'Excluded plan agency keys for a platform-admin statement. Empty for everyone else. Do not inline this join back into support SELECT policies; Realtime drops those events.';

CREATE OR REPLACE FUNCTION public.can_select_support_ticket_reply(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = p_ticket_id
      AND CASE
        WHEN (SELECT public.is_platform_admin()) THEN
          COALESCE(
            public.platform_support_agency_key(t.agency_id) <> ALL (COALESCE((SELECT public.platform_support_excluded_keys()), ARRAY[]::text[])),
            true
          )
          OR lower(t.customer_email) = NULLIF((SELECT public.current_auth_email()), '')
        ELSE
          (
            public.can_access_agency(t.agency_id)
            AND public.support_can_see_ticket(t.agency_id, t.assigned_to)
          )
          OR lower(t.customer_email) = NULLIF((SELECT public.current_auth_email()), '')
      END
  );
$$;

COMMENT ON FUNCTION public.can_select_support_ticket_reply(uuid) IS
  'True when the caller may read this ticket, so reply rows follow the parent ticket. Platform admins do not call support_can_see_ticket.';

REVOKE ALL ON FUNCTION public.platform_support_excluded_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_support_excluded_keys() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_select_support_ticket_reply(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_select_support_ticket_reply(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_support_agency_key(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Agency owners can read chat threads" ON public.chat_threads;
CREATE POLICY "Agency owners can read chat threads"
  ON public.chat_threads
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN (SELECT public.is_platform_admin()) THEN
        COALESCE(
          public.platform_support_agency_key(agency_id) <> ALL (COALESCE((SELECT public.platform_support_excluded_keys()), ARRAY[]::text[])),
          true
        )
      ELSE
        public.can_access_agency(agency_id)
        AND public.support_can_see_chat(agency_id, user_identifier)
    END
  );

DROP POLICY IF EXISTS "Agency owners can view support tickets" ON public.support_tickets;
CREATE POLICY "Agency owners can view support tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN (SELECT public.is_platform_admin()) THEN
        COALESCE(
          public.platform_support_agency_key(agency_id) <> ALL (COALESCE((SELECT public.platform_support_excluded_keys()), ARRAY[]::text[])),
          true
        )
        OR lower(customer_email) = NULLIF((SELECT public.current_auth_email()), '')
      ELSE
        (
          public.can_access_agency(agency_id)
          AND public.support_can_see_ticket(agency_id, assigned_to)
        )
        OR lower(customer_email) = NULLIF((SELECT public.current_auth_email()), '')
    END
  );

DROP POLICY IF EXISTS "Agency owners can view ai chat messages" ON public.ai_chat_messages;
CREATE POLICY "Agency owners can view ai chat messages"
  ON public.ai_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN (SELECT public.is_platform_admin()) THEN
        COALESCE(
          public.platform_support_agency_key(agency_id) <> ALL (COALESCE((SELECT public.platform_support_excluded_keys()), ARRAY[]::text[])),
          true
        )
      ELSE
        public.can_access_agency(agency_id)
        AND public.support_can_see_chat(agency_id, user_identifier)
    END
    OR lower(user_identifier) = NULLIF((SELECT public.current_auth_email()), '')
  );

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff and customers can read ticket replies" ON public.support_ticket_replies;
CREATE POLICY "Staff and customers can read ticket replies"
  ON public.support_ticket_replies
  FOR SELECT
  TO authenticated
  USING (public.can_select_support_ticket_reply(ticket_id));

ALTER TABLE public.ai_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.agency_owner_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_ticket_replies REPLICA IDENTITY FULL;

DO $$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  FOREACH tbl IN ARRAY ARRAY[
    'ai_chat_messages',
    'agency_owner_messages',
    'chat_threads',
    'support_tickets',
    'support_ticket_replies'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = 'public'
        AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
