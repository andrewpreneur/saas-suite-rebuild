-- 1. Entries table
CREATE TABLE public.giveaway_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  agency_id text,
  opted_in_at timestamp with time zone NOT NULL DEFAULT now(),
  points integer NOT NULL DEFAULT 0,
  tickets integer NOT NULL DEFAULT 1,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scored_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.giveaway_entries TO authenticated;
GRANT ALL ON public.giveaway_entries TO service_role;

ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own giveaway entry"
ON public.giveaway_entries FOR SELECT TO authenticated
USING (email = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can create their own giveaway entry"
ON public.giveaway_entries FOR INSERT TO authenticated
WITH CHECK (email = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can update their own giveaway entry"
ON public.giveaway_entries FOR UPDATE TO authenticated
USING (email = lower(auth.jwt() ->> 'email'))
WITH CHECK (email = lower(auth.jwt() ->> 'email'));

CREATE INDEX idx_giveaway_entries_points ON public.giveaway_entries (points DESC, opted_in_at ASC);

CREATE OR REPLACE FUNCTION public.giveaway_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_giveaway_entries_updated_at
BEFORE UPDATE ON public.giveaway_entries
FOR EACH ROW EXECUTE FUNCTION public.giveaway_touch_updated_at();

-- 2. Score recalculation from real platform activity (only after opt-in)
CREATE OR REPLACE FUNCTION public.giveaway_recalculate(_email text)
RETURNS public.giveaway_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.giveaway_entries;
  v_ids text[];
  v_since timestamptz;
  n_users int := 0;
  n_weekly int := 0;
  n_modules int := 0;
  n_days int := 0;
  has_slack boolean := false;
  v_points int := 0;
  v_tickets int := 1;
BEGIN
  SELECT * INTO v_entry FROM public.giveaway_entries WHERE email = lower(_email);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_since := v_entry.opted_in_at;

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
    -- Users onboarded since opting in
    SELECT count(*) INTO n_users
    FROM public.user_progress up
    WHERE up.agency_id = ANY(v_ids) AND up.created_at >= v_since;

    -- Average weekly active users (active in the last 7 days)
    SELECT count(*) INTO n_weekly
    FROM public.user_progress up
    WHERE up.agency_id = ANY(v_ids)
      AND up.last_accessed IS NOT NULL
      AND up.last_accessed >= now() - interval '7 days';

    -- Training video / module completions since opting in
    SELECT count(*) INTO n_modules
    FROM public.module_completion mc
    JOIN public.user_progress up ON up.id = mc.user_id
    WHERE up.agency_id = ANY(v_ids)
      AND mc.completed IS TRUE
      AND mc.completed_at >= v_since;

    -- Slack integration connected
    SELECT EXISTS (
      SELECT 1 FROM public.slack_workspace_links w
      WHERE w.agency_id = ANY(v_ids) OR w.agency_ids && v_ids
    ) INTO has_slack;
  END IF;

  -- Consistent login activity: distinct days the owner was in the platform
  SELECT count(DISTINCT date_trunc('day', s.session_started_at)) INTO n_days
  FROM public.user_activity_sessions s
  WHERE lower(s.user_email) = v_entry.email
    AND s.session_started_at >= v_since;

  v_points := (n_users * 25) + (n_weekly * 10) + (n_modules * 5) + (n_days * 5)
              + CASE WHEN has_slack THEN 100 ELSE 0 END;
  v_tickets := 1 + n_users;

  UPDATE public.giveaway_entries
  SET points = v_points,
      tickets = v_tickets,
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
$$;

REVOKE ALL ON FUNCTION public.giveaway_recalculate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_recalculate(text) TO service_role;

-- 3. Opt in (uses the caller's own session email)
CREATE OR REPLACE FUNCTION public.giveaway_opt_in(_display_name text DEFAULT NULL)
RETURNS public.giveaway_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
  v_agency text;
  v_entry public.giveaway_entries;
BEGIN
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_entry FROM public.giveaway_entries WHERE email = v_email;
  IF FOUND THEN
    RETURN public.giveaway_recalculate(v_email);
  END IF;

  SELECT s.agency_id, NULLIF(trim(coalesce(s.full_name, s.agency_name, '')), '')
    INTO v_agency, v_name
  FROM public.saas_suite_users s
  WHERE lower(s.email) = v_email
  LIMIT 1;

  v_name := COALESCE(NULLIF(trim(coalesce(_display_name, '')), ''), v_name, split_part(v_email, '@', 1));

  INSERT INTO public.giveaway_entries (email, display_name, agency_id)
  VALUES (v_email, v_name, v_agency)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING * INTO v_entry;

  RETURN public.giveaway_recalculate(v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_opt_in(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.giveaway_opt_in(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.giveaway_opt_in(text) TO service_role;

-- 4. Public leaderboard (names only, no emails)
CREATE OR REPLACE FUNCTION public.giveaway_leaderboard(_limit int DEFAULT 50)
RETURNS TABLE (rank bigint, display_name text, points integer, tickets integer, joined_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_number() OVER (ORDER BY e.points DESC, e.opted_in_at ASC) AS rank,
         e.display_name, e.points, e.tickets, e.opted_in_at
  FROM public.giveaway_entries e
  ORDER BY e.points DESC, e.opted_in_at ASC
  LIMIT LEAST(COALESCE(_limit, 50), 250);
$$;

GRANT EXECUTE ON FUNCTION public.giveaway_leaderboard(int) TO anon, authenticated, service_role;

-- 5. Public stats + the caller's own standing
CREATE OR REPLACE FUNCTION public.giveaway_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_total int;
  v_tickets int;
  v_points int;
  v_me public.giveaway_entries;
  v_rank bigint;
BEGIN
  SELECT count(*), COALESCE(sum(tickets), 0), COALESCE(sum(points), 0)
    INTO v_total, v_tickets, v_points
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
    'total_tickets', v_tickets,
    'total_points', v_points,
    'me', CASE WHEN v_me.id IS NULL THEN NULL ELSE jsonb_build_object(
      'display_name', v_me.display_name,
      'points', v_me.points,
      'tickets', v_me.tickets,
      'rank', v_rank,
      'opted_in_at', v_me.opted_in_at,
      'breakdown', v_me.breakdown,
      'odds', CASE WHEN v_tickets > 0 THEN round((v_me.tickets::numeric / v_tickets) * 100, 2) ELSE 0 END
    ) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.giveaway_stats() TO anon, authenticated, service_role;

-- 6. Realtime for the live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.giveaway_entries;
ALTER TABLE public.giveaway_entries REPLICA IDENTITY FULL;