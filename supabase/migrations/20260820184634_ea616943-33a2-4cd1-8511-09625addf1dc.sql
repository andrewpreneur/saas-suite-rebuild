ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS install_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_device text,
  ADD COLUMN IF NOT EXISTS last_device text,
  ADD COLUMN IF NOT EXISTS guest_access_until timestamptz,
  ADD COLUMN IF NOT EXISTS install_guide_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_rescue_sent_at timestamptz;

-- Mark install as actually confirmed (fired by install events in the app)
CREATE OR REPLACE FUNCTION public.record_install_confirmed(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.saas_suite_users
     SET install_confirmed_at = COALESCE(install_confirmed_at, now())
   WHERE lower(email) = lower(btrim(user_email));
  RETURN true;
END;
$$;

-- Record the device a user is on (mobile / desktop / tablet)
CREATE OR REPLACE FUNCTION public.record_user_device(user_email text, device text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF device IS NULL OR device NOT IN ('mobile','tablet','desktop') THEN
    RETURN false;
  END IF;
  UPDATE public.saas_suite_users
     SET last_device = device,
         signup_device = COALESCE(signup_device, device)
   WHERE lower(email) = lower(btrim(user_email));
  RETURN true;
END;
$$;

-- Start the 24-hour guest-preview window (idempotent: never extends an existing window)
CREATE OR REPLACE FUNCTION public.start_guest_access_window(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_until timestamptz;
BEGIN
  UPDATE public.saas_suite_users
     SET guest_access_until = COALESCE(guest_access_until, now() + interval '24 hours')
   WHERE lower(email) = lower(btrim(user_email))
  RETURNING guest_access_until INTO v_until;

  RETURN jsonb_build_object('guest_access_until', v_until, 'guest_allowed', v_until IS NOT NULL AND v_until > now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_install_confirmed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_guest_access_window(text) TO authenticated;

DROP FUNCTION IF EXISTS public.get_onboarding_funnel();

CREATE OR REPLACE FUNCTION public.get_onboarding_funnel()
 RETURNS TABLE(email text, full_name text, plan text, approval text, phone text, created_at timestamp with time zone, last_accessed timestamp with time zone, login_count integer, onboarding_intent text, onboarding_skipped boolean, onboarding_step integer, onboarding_completed boolean, onboarding_completed_at timestamp with time zone, reached_app boolean, initial_questions_completed boolean, agency_named boolean, branding_configured boolean, hub_configured boolean, menu_link_installed boolean, client_count integer, signup_device text, last_device text, install_confirmed_at timestamp with time zone, guest_access_until timestamp with time zone, stage integer, stage_label text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(COALESCE(public.current_auth_email(), '')) <> 'andrew@dna-media.net' THEN
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