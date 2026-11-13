-- Platform admins: andrew@dna-media.net and team@yoursoftwareonboarding.com.
--
-- Support SELECT policies already call is_platform_admin() (chat_threads,
-- support_tickets, ai_chat_messages, and support_ticket_replies via
-- can_select_support_ticket_reply). Those policies stay as they are, including
-- the (SELECT public.is_platform_admin()) InitPlans. This migration only
-- widens the function, then points leftover admin checks that still compared
-- the JWT email to Andrew at that same function.
--
-- current_auth_email() is lower(coalesce(auth.jwt()->>'email','')). The
-- function keeps its original signature, language, volatility, SECURITY DEFINER,
-- and search_path. Andrew remains on the list. No other email is added.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_auth_email() IN (
    'andrew@dna-media.net',
    'team@yoursoftwareonboarding.com'
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True when the signed-in JWT email is a platform admin (andrew@dna-media.net or team@yoursoftwareonboarding.com).';

-- /admin/support loads the conversation through this RPC, which bypassed the function.
CREATE OR REPLACE FUNCTION public.get_ticket_replies_for_staff(p_ticket_id uuid)
RETURNS TABLE(id uuid, sender_role text, sender_name text, sender_email text, body text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_agency text;
BEGIN
  SELECT agency_id INTO v_agency FROM public.support_tickets WHERE support_tickets.id = p_ticket_id;
  IF v_agency IS NULL THEN RETURN; END IF;
  IF NOT (public.is_platform_admin() OR public.can_access_agency(v_agency)) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT r.id, r.sender_role, r.sender_name, r.sender_email, r.body, r.created_at
  FROM public.support_ticket_replies r WHERE r.ticket_id = p_ticket_id ORDER BY r.created_at ASC, r.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ticket_replies_for_staff(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_replies_for_staff(uuid) TO authenticated;

-- Admin portal panels that still compared the email instead of the function.
CREATE OR REPLACE FUNCTION public.admin_list_agency_support_accounts()
RETURNS TABLE(
  owner_email text,
  owner_name text,
  plan text,
  agency_id text,
  white_label_domain text,
  seats integer,
  assigned integer,
  clients jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH owners AS (
    SELECT lower(u.email) AS oe,
           u.full_name AS full_name,
           u.plan::text AS plan,
           u.agency_id AS agency_id,
           u.white_label_domain AS white_label_domain,
           COALESCE(u.agency_support_wallet, 0)::int AS seats
      FROM public.saas_suite_users u
     WHERE COALESCE(u.agency_support_wallet, 0) > 0
        OR lower(u.email) IN (SELECT lower(c.owner_email) FROM public.agency_support_clients c)
  )
  SELECT o.oe,
         o.full_name,
         o.plan,
         o.agency_id,
         o.white_label_domain,
         o.seats,
         COALESCE((SELECT count(*)::int FROM public.agency_support_clients c
                    WHERE lower(c.owner_email) = o.oe AND c.active), 0),
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'id', c.id,
                     'client_email', c.client_email,
                     'client_name', c.client_name,
                     'client_phone', c.client_phone,
                     'client_company', c.client_company,
                     'location_id', c.location_id,
                     'active', c.active,
                     'assigned_at', c.assigned_at,
                     'locked_until', c.locked_until,
                     'created_at', c.created_at
                   ) ORDER BY c.active DESC, c.created_at DESC)
                   FROM public.agency_support_clients c
                  WHERE lower(c.owner_email) = o.oe), '[]'::jsonb)
    FROM owners o
   ORDER BY o.seats DESC, o.oe;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_onboarding_funnel()
 RETURNS TABLE(email text, full_name text, plan text, approval text, phone text, created_at timestamp with time zone, last_accessed timestamp with time zone, login_count integer, onboarding_intent text, onboarding_skipped boolean, onboarding_step integer, onboarding_completed boolean, onboarding_completed_at timestamp with time zone, reached_app boolean, initial_questions_completed boolean, agency_named boolean, branding_configured boolean, hub_configured boolean, menu_link_installed boolean, client_count integer, signup_device text, last_device text, install_confirmed_at timestamp with time zone, guest_access_until timestamp with time zone, stage integer, stage_label text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT u.id AS uid,
           ARRAY(SELECT x FROM unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) x WHERE x IS NOT NULL AND x <> '') AS agency_ids
    FROM public.saas_suite_users u
  ),
  clients AS (
    SELECT i.uid, COUNT(DISTINCT p.id)::int AS cnt
    FROM ids i
    LEFT JOIN public.user_progress p ON p.agency_id = ANY (i.agency_ids)
    GROUP BY i.uid
  ),
  menu AS (
    SELECT i.uid, BOOL_OR(m.menu_link_id IS NOT NULL AND m.menu_link_id <> '') AS installed
    FROM ids i
    LEFT JOIN public.agency_menu_config m ON m.agency_id = ANY (i.agency_ids)
    GROUP BY i.uid
  ),
  hub AS (
    SELECT i.uid, COUNT(v.*) > 0 AS configured
    FROM ids i
    LEFT JOIN public.v2_home_settings v ON v.agency_id = ANY (i.agency_ids)
    GROUP BY i.uid
  ),
  base AS (
    SELECT
      u.email,
      u.full_name,
      u.plan::text AS plan,
      u.approval,
      u.bonuses_phone AS phone,
      u.created_at,
      u.last_accessed,
      COALESCE(u.login_count, 0) AS login_count,
      u.onboarding_intent,
      COALESCE(u.onboarding_skipped, false) AS onboarding_skipped,
      COALESCE(u.onboarding_step, 0) AS onboarding_step,
      COALESCE(u.onboarding_completed, false) AS onboarding_completed,
      u.onboarding_completed_at,
      (COALESCE(u.login_count, 0) > 0) AS reached_app,
      COALESCE(u.initial_questions_completed, false) AS initial_questions_completed,
      (u.agency_name IS NOT NULL AND btrim(u.agency_name) <> '') AS agency_named,
      (u.primary_color IS NOT NULL OR u.kb_logo_url IS NOT NULL) AS branding_configured,
      COALESCE(h.configured, false) AS hub_configured,
      (COALESCE(m.installed, false) OR u.install_confirmed_at IS NOT NULL) AS menu_link_installed,
      COALESCE(c.cnt, 0) AS client_count,
      u.signup_device,
      u.last_device,
      u.install_confirmed_at,
      u.guest_access_until
    FROM public.saas_suite_users u
    LEFT JOIN clients c ON c.uid = u.id
    LEFT JOIN menu m ON m.uid = u.id
    LEFT JOIN hub h ON h.uid = u.id
  )
  SELECT b.*, s.stage, s.label
  FROM base b
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN b.client_count > 0 THEN 7
      WHEN b.onboarding_completed THEN 6
      WHEN b.menu_link_installed THEN 5
      WHEN b.branding_configured OR b.hub_configured THEN 4
      WHEN b.agency_named THEN 3
      WHEN b.initial_questions_completed THEN 2
      WHEN b.reached_app THEN 1
      ELSE 0
    END AS stage
  ) st
  CROSS JOIN LATERAL (
    SELECT st.stage AS stage,
      CASE st.stage
        WHEN 7 THEN 'Live with clients'
        WHEN 6 THEN 'Onboarding completed'
        WHEN 5 THEN 'Installed in GHL'
        WHEN 4 THEN 'Branded / hub set up'
        WHEN 3 THEN 'Named agency'
        WHEN 2 THEN 'Answered questions, not installed'
        WHEN 1 THEN 'Reached app, questions unfinished'
        ELSE 'Signed up, never logged in'
      END AS label
  ) s;
END;
$function$;

-- Academy content owner is the same allowlist. Keep the latest SECURITY INVOKER setting.
CREATE OR REPLACE FUNCTION public.is_academy_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.is_platform_admin();
$$;

-- Admin-portal tables whose policies still named Andrew. Scalar subselects stay InitPlans.
DROP POLICY IF EXISTS "Admin manages ai support kb" ON public.ai_support_kb;
CREATE POLICY "Admin manages ai support kb" ON public.ai_support_kb
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Admin manages ai message ratings" ON public.ai_support_message_ratings;
CREATE POLICY "Admin manages ai message ratings" ON public.ai_support_message_ratings
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin can manage copilot message ratings" ON public.copilot_message_ratings;
CREATE POLICY "Platform admin can manage copilot message ratings" ON public.copilot_message_ratings
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin manages copilot prompt edits" ON public.copilot_prompt_edits;
CREATE POLICY "Platform admin manages copilot prompt edits" ON public.copilot_prompt_edits
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin can delete account_admins" ON public.account_admins;
CREATE POLICY "Platform admin can delete account_admins" ON public.account_admins
  FOR DELETE TO authenticated
  USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin can update account_admins" ON public.account_admins;
CREATE POLICY "Platform admin can update account_admins" ON public.account_admins
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Admin reads error logs" ON public.client_error_logs;
CREATE POLICY "Admin reads error logs" ON public.client_error_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin can read leads" ON public.one_feature_training_leads;
CREATE POLICY "Platform admin can read leads" ON public.one_feature_training_leads
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin views signup failures" ON public.auth_signup_failures;
CREATE POLICY "Platform admin views signup failures" ON public.auth_signup_failures
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Platform admin can view analytics events" ON public.site_analytics_events;
CREATE POLICY "Platform admin can view analytics events" ON public.site_analytics_events
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Admins can view agency id migrations" ON public.agency_id_migrations;
CREATE POLICY "Admins can view agency id migrations" ON public.agency_id_migrations
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "Andrew can upload community skill packs" ON storage.objects;
CREATE POLICY "Andrew can upload community skill packs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-skill-packs'
    AND (SELECT public.is_platform_admin())
  );

DROP POLICY IF EXISTS "Andrew can replace community skill packs" ON storage.objects;
CREATE POLICY "Andrew can replace community skill packs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'community-skill-packs'
    AND (SELECT public.is_platform_admin())
  )
  WITH CHECK (
    bucket_id = 'community-skill-packs'
    AND (SELECT public.is_platform_admin())
  );

DROP POLICY IF EXISTS "Andrew can remove community skill packs" ON storage.objects;
CREATE POLICY "Andrew can remove community skill packs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-skill-packs'
    AND (SELECT public.is_platform_admin())
  );
