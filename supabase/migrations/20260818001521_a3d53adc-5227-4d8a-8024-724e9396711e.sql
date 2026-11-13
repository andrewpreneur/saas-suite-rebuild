-- Points-only giveaway: drop tickets, never backfill pre-opt-in activity

DROP FUNCTION IF EXISTS public.giveaway_leaderboard(integer);

CREATE FUNCTION public.giveaway_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(rank bigint, display_name text, points integer, joined_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT row_number() OVER (ORDER BY e.points DESC, e.opted_in_at ASC) AS rank,
         e.display_name, e.points, e.opted_in_at
  FROM public.giveaway_entries e
  ORDER BY e.points DESC, e.opted_in_at ASC
  LIMIT LEAST(COALESCE(_limit, 50), 250);
$function$;

CREATE OR REPLACE FUNCTION public.giveaway_recalculate(_email text)
RETURNS public.giveaway_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry public.giveaway_entries;
  v_ids text[];
  v_since timestamptz;
  v_window_start timestamptz;
  n_users int := 0;
  n_weekly int := 0;
  n_modules int := 0;
  n_days int := 0;
  has_slack boolean := false;
  v_points int := 0;
BEGIN
  SELECT * INTO v_entry FROM public.giveaway_entries WHERE email = lower(_email);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_since := v_entry.opted_in_at;
  -- Weekly-active window never reaches back before the opt-in moment
  v_window_start := GREATEST(v_since, now() - interval '7 days');

  SELECT COALESCE(array_remove(ARRAY[s.agency_id, s.agency_id_basic, s.agency_id_advanced, s.agency_id_elite], NULL), ARRAY[]::text[])
    INTO v_ids
  FROM public.saas_suite_users s
  WHERE lower(s.email) = v_entry.email
  LIMIT 1;

  v_ids := COALESCE(v_ids, ARRAY[]::text[]);
  IF v_entry.agency_id IS NOT NULL AND NOT (v_entry.agency_id = ANY(v_ids)) THEN
    v_ids := v_ids || v_entry.agency_id;
  END IF;

  IF array_length(v_ids, 1) > 0 THEN
    SELECT count(*) INTO n_users
    FROM public.user_progress up
    WHERE up.agency_id = ANY(v_ids) AND up.created_at >= v_since;

    SELECT count(*) INTO n_weekly
    FROM public.user_progress up
    WHERE up.agency_id = ANY(v_ids)
      AND up.last_accessed IS NOT NULL
      AND up.last_accessed >= v_window_start;

    SELECT count(*) INTO n_modules
    FROM public.module_completion mc
    JOIN public.user_progress up ON up.id = mc.user_id
    WHERE up.agency_id = ANY(v_ids)
      AND mc.completed IS TRUE
      AND mc.completed_at >= v_since;

    -- Slack only counts if the workspace was linked after opting in
    SELECT EXISTS (
      SELECT 1 FROM public.slack_workspace_links w
      WHERE (w.agency_id = ANY(v_ids) OR w.agency_ids && v_ids)
        AND w.created_at >= v_since
    ) INTO has_slack;
  END IF;

  SELECT count(DISTINCT date_trunc('day', s.session_started_at)) INTO n_days
  FROM public.user_activity_sessions s
  WHERE lower(s.user_email) = v_entry.email
    AND s.session_started_at >= v_since;

  v_points := (n_users * 25) + (n_weekly * 10) + (n_modules * 5) + (n_days * 5)
              + CASE WHEN has_slack THEN 100 ELSE 0 END;

  UPDATE public.giveaway_entries
  SET points = v_points,
      tickets = 0,
      last_scored_at = now(),
      breakdown = jsonb_build_object(
        'users_onboarded', n_users,
        'users_onboarded_points', n_users * 25,
        'weekly_active_users', n_weekly,
        'weekly_active_points', n_weekly * 10,
        'module_completions', n_modules,
        'module_completion_points', n_modules * 5,
        'login_days', n_days,
        'login_day_points', n_days * 5,
        'slack_connected', has_slack,
        'slack_points', CASE WHEN has_slack THEN 100 ELSE 0 END
      )
  WHERE id = v_entry.id
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$function$;

CREATE OR REPLACE FUNCTION public.giveaway_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_total int;
  v_points int;
  v_me public.giveaway_entries;
  v_rank bigint;
BEGIN
  SELECT count(*), COALESCE(sum(points), 0) INTO v_total, v_points
  FROM public.giveaway_entries;

  IF v_email <> '' THEN
    SELECT * INTO v_me FROM public.giveaway_entries WHERE email = v_email;
    IF FOUND THEN
      SELECT count(*) + 1 INTO v_rank
      FROM public.giveaway_entries e
      WHERE e.points > v_me.points
         OR (e.points = v_me.points AND e.opted_in_at < v_me.opted_in_at);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'entrants', v_total,
    'total_points', v_points,
    'me', CASE WHEN v_me.id IS NULL THEN NULL ELSE jsonb_build_object(
      'display_name', v_me.display_name,
      'points', v_me.points,
      'rank', v_rank,
      'opted_in_at', v_me.opted_in_at,
      'breakdown', v_me.breakdown
    ) END
  );
END;
$function$;