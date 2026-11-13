-- 1) De-duplicate login counting (was incremented on every auth state change / page load)
CREATE OR REPLACE FUNCTION public.record_user_login(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record record;
  normalized_email text;
  days_since_last_login integer;
  is_weekly_active boolean;
  should_count boolean;
BEGIN
  normalized_email := lower(btrim(user_email));

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email cannot be empty');
  END IF;

  SELECT last_login_at, login_count, weekly_login_count, weekly_login_reset_at
  INTO user_record
  FROM public.saas_suite_users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.register_starter_user(normalized_email, NULL);

    SELECT last_login_at, login_count, weekly_login_count, weekly_login_reset_at
    INTO user_record
    FROM public.saas_suite_users
    WHERE lower(email) = normalized_email
    LIMIT 1;
  END IF;

  days_since_last_login := COALESCE(
    EXTRACT(DAY FROM (now() - user_record.last_login_at))::integer,
    0
  );

  -- Only treat this as a distinct login if the previous one was 30+ minutes ago.
  should_count := user_record.last_login_at IS NULL
    OR (now() - user_record.last_login_at) > interval '30 minutes';

  IF NOT should_count THEN
    UPDATE public.saas_suite_users
    SET last_accessed = now()
    WHERE lower(email) = normalized_email;
  ELSIF user_record.weekly_login_reset_at IS NULL
     OR (now() - user_record.weekly_login_reset_at) > interval '7 days' THEN
    UPDATE public.saas_suite_users
    SET last_login_at = now(),
        last_accessed = now(),
        login_count = COALESCE(login_count, 0) + 1,
        weekly_login_count = 1,
        weekly_login_reset_at = now()
    WHERE lower(email) = normalized_email;
  ELSE
    UPDATE public.saas_suite_users
    SET last_login_at = now(),
        last_accessed = now(),
        login_count = COALESCE(login_count, 0) + 1,
        weekly_login_count = COALESCE(weekly_login_count, 0) + 1
    WHERE lower(email) = normalized_email;
  END IF;

  SELECT weekly_login_count >= 3 INTO is_weekly_active
  FROM public.saas_suite_users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'counted', should_count,
    'days_inactive', days_since_last_login,
    'weekly_active', COALESCE(is_weekly_active, false)
  );
END;
$$;

-- 2) Admin-only onboarding funnel report
CREATE OR REPLACE FUNCTION public.get_onboarding_funnel()
RETURNS TABLE (
  email text,
  full_name text,
  plan text,
  approval text,
  phone text,
  created_at timestamptz,
  last_accessed timestamptz,
  login_count integer,
  onboarding_intent text,
  onboarding_skipped boolean,
  onboarding_step integer,
  onboarding_completed boolean,
  onboarding_completed_at timestamptz,
  reached_app boolean,
  initial_questions_completed boolean,
  agency_named boolean,
  branding_configured boolean,
  hub_configured boolean,
  menu_link_installed boolean,
  client_count integer,
  stage integer,
  stage_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      (COALESCE(u.login_count, 0) > 0 OR u.last_accessed IS NOT NULL) AS reached_app,
      COALESCE(u.initial_questions_completed, false) AS initial_questions_completed,
      (u.agency_name IS NOT NULL AND btrim(u.agency_name) <> '') AS agency_named,
      (u.primary_color IS NOT NULL OR u.kb_logo_url IS NOT NULL) AS branding_configured,
      COALESCE(h.configured, false) AS hub_configured,
      COALESCE(m.installed, false) AS menu_link_installed,
      COALESCE(c.cnt, 0) AS client_count
    FROM public.saas_suite_users u
    LEFT JOIN clients c ON c.uid = u.id
    LEFT JOIN menu m ON m.uid = u.id
    LEFT JOIN hub h ON h.uid = u.id
  )
  SELECT b.*,
    s.stage,
    s.label
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
        WHEN 2 THEN 'Answered questions'
        WHEN 1 THEN 'Reached app'
        ELSE 'Signed up only'
      END AS label
  ) s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_onboarding_funnel() TO authenticated;