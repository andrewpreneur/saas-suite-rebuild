-- The daily chart called affiliate_portal_series for 366 days and scanned every
-- pageview/click (about 200k rows), checking the path once per row. That was
-- 7.6s for one affiliate and hit the 8s statement timeout under batch load,
-- so the refresh saved an empty chart.
--
-- A plain btree range on path is the wrong fix here: this database's collation
-- does not order '/' before '0', so '/page/child' falls outside
-- [prefix || '/', prefix || '0'). text_pattern_ops compares bytes, and ~>=~ / ~<~
-- use that order. The chart then seeks the attributed path instead of the
-- whole event_type index.

CREATE INDEX IF NOT EXISTS site_analytics_events_chart_path_idx
  ON public.site_analytics_events (path text_pattern_ops, created_at)
  WHERE event_type IN ('pageview', 'click');

CREATE INDEX IF NOT EXISTS affiliate_events_affiliate_created_idx
  ON public.affiliate_events (affiliate_id, created_at)
  WHERE event_type IN ('view', 'click');

CREATE INDEX IF NOT EXISTS saas_suite_users_affiliate_created_idx
  ON public.saas_suite_users (affiliate_id, created_at)
  WHERE affiliate_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.affiliate_portal_series(
  p_affiliate_id uuid,
  p_slug text,
  p_since timestamptz,
  p_until timestamptz,
  p_page_paths text[]
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := p_since;
  v_until timestamptz := p_until;
  v_slug text := left(coalesce(p_slug, ''), 80);
  v_paths text[] := coalesce(p_page_paths, ARRAY[]::text[]);
  v_kit boolean := false;
  v_days jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '20000', true);
  IF v_since IS NULL OR v_until IS NULL OR v_since >= v_until OR p_affiliate_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  IF v_until - v_since > interval '366 days' THEN
    v_since := v_until - interval '366 days';
  END IF;
  v_kit := EXISTS (
    SELECT 1 FROM unnest(v_paths) AS path
    WHERE lower(path) = '/one-feature-kit' OR lower(path) LIKE '/one-feature-kit/%'
  );

  WITH days AS (
    SELECT generate_series(
      date_trunc('day', v_since),
      date_trunc('day', v_until - interval '1 second'),
      interval '1 day'
    )::date AS day
  ),
  link_events AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) FILTER (WHERE event_type = 'view') AS views,
           count(*) FILTER (WHERE event_type = 'click') AS clicks
    FROM public.affiliate_events
    WHERE affiliate_id = p_affiliate_id
      AND created_at >= v_since
      AND created_at < v_until
      AND event_type IN ('view', 'click')
    GROUP BY 1
  ),
  page_events AS (
    SELECT day,
           count(*) FILTER (WHERE event_type = 'pageview') AS views,
           count(*) FILTER (WHERE event_type = 'click') AS clicks
    FROM (
      SELECT DISTINCT e.id, e.event_type, date_trunc('day', e.created_at)::date AS day
      FROM unnest(v_paths) AS path_prefix(prefix)
      JOIN public.site_analytics_events e
        ON prefix LIKE '/%'
       AND e.created_at >= v_since
       AND e.created_at < v_until
       AND e.event_type IN ('pageview', 'click')
       AND coalesce(e.metadata->>'is_test', '') NOT IN ('1', 'true', 't')
       AND coalesce(e.metadata->>'ofk_test', '') NOT IN ('1', 'true', 't')
       AND coalesce(lower(e.utm_source), '') <> 'qa_test'
       AND coalesce(lower(e.fbclid), '') <> 'test'
       AND (
         e.path = prefix
         OR (e.path ~>=~ (prefix || '/') AND e.path ~<~ (prefix || '0'))
       )
    ) matched
    GROUP BY day
  ),
  kit_clicks AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) AS clicks
    FROM public.kit_events
    WHERE v_kit
      AND created_at >= v_since
      AND created_at < v_until
      AND event IN ('cta_click', 'checkout_start')
      AND is_test IS NOT TRUE
      AND coalesce(lower(utm_source), '') <> 'qa_test'
      AND coalesce(lower(fbclid), '') <> 'test'
    GROUP BY 1
  ),
  signups AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) AS signups
    FROM public.saas_suite_users
    WHERE created_at >= v_since
      AND created_at < v_until
      AND (
        affiliate_id = p_affiliate_id::text
        OR (v_slug <> '' AND affiliate_id = v_slug)
      )
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'views', coalesce(l.views, 0) + coalesce(p.views, 0),
    'clicks', coalesce(l.clicks, 0) + coalesce(p.clicks, 0) + coalesce(k.clicks, 0),
    'signups', coalesce(s.signups, 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO v_days
  FROM days d
  LEFT JOIN link_events l ON l.day = d.day
  LEFT JOIN page_events p ON p.day = d.day
  LEFT JOIN kit_clicks k ON k.day = d.day
  LEFT JOIN signups s ON s.day = d.day;

  RETURN v_days;
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_portal_series(uuid, text, timestamptz, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_portal_series(uuid, text, timestamptz, timestamptz, text[]) TO service_role;
