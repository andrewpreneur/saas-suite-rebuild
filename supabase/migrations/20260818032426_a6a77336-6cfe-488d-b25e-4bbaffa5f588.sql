ALTER TABLE public.giveaway_entries ADD COLUMN IF NOT EXISTS rules_accepted_at timestamptz;

UPDATE public.giveaway_entries SET rules_accepted_at = COALESCE(rules_accepted_at, opted_in_at);

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
  v_until timestamptz;
  n_users int := 0;
  n_modules int := 0;
  n_checklists int := 0;
  n_login_days int := 0;
  has_slack boolean := false;
  v_points int := 0;
BEGIN
  SELECT * INTO v_entry FROM public.giveaway_entries WHERE email = lower(_email);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_since := v_entry.opted_in_at;
  -- Contest ends Sunday, October 25, 2026 at 11:59:59 p.m. Central Time
  v_until := LEAST(now(), '2026-10-26 04:59:59+00'::timestamptz);

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
    -- Net-new end users onboarded after entry (1 pt each)
    SELECT count(*) INTO n_users
    FROM public.user_progress up
    WHERE up.agency_id = ANY(v_ids)
      AND up.created_at >= v_since AND up.created_at <= v_until;

    -- Training videos marked complete (1 pt each)
    SELECT count(*) INTO n_modules
    FROM public.module_completion mc
    JOIN public.user_progress up ON up.id = mc.user_id
    WHERE up.agency_id = ANY(v_ids)
      AND mc.completed IS TRUE
      AND mc.completed_at >= v_since AND mc.completed_at <= v_until;

    -- Onboarding checklists completed (1 pt each)
    SELECT count(*) INTO n_checklists
    FROM public.user_onboarding_checklist_completion c
    WHERE c.agency_id = ANY(v_ids)
      AND c.completed_at >= v_since AND c.completed_at <= v_until;

    -- Login days: 1 pt per unique end user per calendar day (Central Time)
    SELECT count(*) INTO n_login_days
    FROM (
      SELECT DISTINCT lower(pe.user_email) AS u,
             (pe.created_at AT TIME ZONE 'America/Chicago')::date AS d
      FROM public.platform_events pe
      WHERE pe.agency_id = ANY(v_ids)
        AND pe.trigger_type IN ('existing_user_login', 'new_user_login')
        AND pe.user_email IS NOT NULL
        AND pe.created_at >= v_since AND pe.created_at <= v_until
    ) x;

    -- Slack install after entry (one-time 20 pts)
    SELECT EXISTS (
      SELECT 1 FROM public.slack_workspace_links w
      WHERE (w.agency_id = ANY(v_ids) OR w.agency_ids && v_ids)
        AND w.created_at >= v_since AND w.created_at <= v_until
    ) INTO has_slack;
  END IF;

  v_points := n_users + n_modules + n_checklists + n_login_days
              + CASE WHEN has_slack THEN 20 ELSE 0 END;

  UPDATE public.giveaway_entries
  SET points = v_points,
      tickets = 0,
      last_scored_at = now(),
      breakdown = jsonb_build_object(
        'users_onboarded', n_users,
        'users_onboarded_points', n_users,
        'module_completions', n_modules,
        'module_completion_points', n_modules,
        'checklist_completions', n_checklists,
        'checklist_completion_points', n_checklists,
        'login_days', n_login_days,
        'login_day_points', n_login_days,
        'slack_connected', has_slack,
        'slack_points', CASE WHEN has_slack THEN 20 ELSE 0 END
      ),
      updated_at = now()
  WHERE email = v_entry.email
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$function$;

CREATE OR REPLACE FUNCTION public.giveaway_opt_in(_display_name text DEFAULT NULL::text, _accept_rules boolean DEFAULT false)
RETURNS public.giveaway_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF _accept_rules IS NOT TRUE THEN
    RAISE EXCEPTION 'You must agree to the Official Rules to enter';
  END IF;

  IF now() > '2026-10-26 04:59:59+00'::timestamptz THEN
    RAISE EXCEPTION 'The entry period for this challenge has closed';
  END IF;

  SELECT s.agency_id, NULLIF(trim(coalesce(s.full_name, s.agency_name, '')), '')
    INTO v_agency, v_name
  FROM public.saas_suite_users s
  WHERE lower(s.email) = v_email
  LIMIT 1;

  v_name := COALESCE(NULLIF(trim(coalesce(_display_name, '')), ''), v_name, split_part(v_email, '@', 1));

  INSERT INTO public.giveaway_entries (email, display_name, agency_id, rules_accepted_at)
  VALUES (v_email, v_name, v_agency, now())
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name,
    rules_accepted_at = COALESCE(public.giveaway_entries.rules_accepted_at, now())
  RETURNING * INTO v_entry;

  RETURN public.giveaway_recalculate(v_email);
END;
$function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT email FROM public.giveaway_entries LOOP
    PERFORM public.giveaway_recalculate(r.email);
  END LOOP;
END $$;