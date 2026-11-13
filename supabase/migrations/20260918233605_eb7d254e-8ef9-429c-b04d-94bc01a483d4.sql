ALTER TABLE public.slack_channel_agency_map
  ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_report_last_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_slack_weekly_report_pref(user_email text)
RETURNS TABLE(connected boolean, enabled boolean, last_sent_at timestamptz, channel_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids text[];
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS x
      FROM public.saas_suite_users u
      WHERE lower(trim(u.email)) = lower(trim(user_email))
    ) s WHERE x IS NOT NULL AND x <> ''
  ) INTO ids;

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true,
         COALESCE(m.weekly_report_enabled, false),
         m.weekly_report_last_sent_at,
         m.slack_channel_id
  FROM public.slack_channel_agency_map m
  WHERE m.agency_id = ANY(ids)
    AND m.is_active = true
    AND m.bot_token IS NOT NULL
  ORDER BY m.installed_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz, NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_slack_weekly_report_pref(user_email text, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids text[];
  updated int;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS x
      FROM public.saas_suite_users u
      WHERE lower(trim(u.email)) = lower(trim(user_email))
    ) s WHERE x IS NOT NULL AND x <> ''
  ) INTO ids;

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.slack_channel_agency_map m
  SET weekly_report_enabled = COALESCE(p_enabled, false),
      updated_at = now()
  WHERE m.agency_id = ANY(ids)
    AND m.is_active = true
    AND m.bot_token IS NOT NULL;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_slack_weekly_report_pref(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_slack_weekly_report_pref(text, boolean) TO anon, authenticated, service_role;

SELECT cron.unschedule('slack-weekly-support-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'slack-weekly-support-report');

SELECT cron.schedule(
  'slack-weekly-support-report',
  '0 14 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/slack-weekly-report',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);