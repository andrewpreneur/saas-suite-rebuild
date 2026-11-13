-- Rename carry-over: these triggers only fired when agency_id was in the UPDATE's SET
-- clause, so renames via update_account_profile (agency_name only) renamed IDs
-- without moving the agency's data. Fire on any account update instead.
DROP TRIGGER IF EXISTS trg_carry_agency_data_on_id_change ON public.saas_suite_users;
CREATE TRIGGER trg_carry_agency_data_on_id_change
  AFTER UPDATE ON public.saas_suite_users
  FOR EACH ROW EXECUTE FUNCTION public.carry_agency_data_on_id_change();

DROP TRIGGER IF EXISTS trg_notify_agency_id_change ON public.saas_suite_users;
CREATE TRIGGER trg_notify_agency_id_change
  AFTER UPDATE ON public.saas_suite_users
  FOR EACH ROW EXECUTE FUNCTION public.notify_agency_id_change();

DROP TRIGGER IF EXISTS seed_training_chunks_on_user ON public.saas_suite_users;
CREATE TRIGGER seed_training_chunks_on_user
  AFTER INSERT OR UPDATE ON public.saas_suite_users
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_training_chunks();

-- Page Analytics: server-side aggregation so the admin panel stops pulling
-- tens of thousands of raw rows through PostgREST.
CREATE OR REPLACE FUNCTION public.page_analytics_summary(p_days int DEFAULT 30, p_path text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT id, created_at, session_id, visitor_key, ip_address, path, event_type, label, value,
         duration_ms, referrer, utm_source, device, country, user_email, plan_type, metadata
  FROM public.site_analytics_events
  WHERE created_at > now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
    AND event_type <> 'hover_intent'
    AND (p_path IS NULL OR path = p_path)
),
page_base AS (
  SELECT created_at, visitor_key, path, event_type, label, value, duration_ms
  FROM public.site_analytics_events
  WHERE created_at > now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
    AND event_type <> 'hover_intent'
),
totals AS (
  SELECT jsonb_build_object(
    'views', count(*) FILTER (WHERE event_type = 'pageview'),
    'visitors', count(DISTINCT visitor_key) FILTER (WHERE visitor_key IS NOT NULL AND visitor_key <> ''),
    'clicks', count(*) FILTER (WHERE event_type = 'click'),
    'avg_time_ms', coalesce(avg(duration_ms) FILTER (WHERE event_type = 'exit' AND duration_ms IS NOT NULL AND label = 'time_on_page'), 0)
  ) j FROM base
),
pages AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'path', s.path, 'views', s.views, 'visitors', s.visitors, 'clicks', s.clicks,
    'videos', s.videos, 'avg_time_ms', s.avg_time_ms, 'avg_scroll', s.avg_scroll)
    ORDER BY s.views DESC), '[]'::jsonb) j
  FROM (
    SELECT path,
      count(*) FILTER (WHERE event_type = 'pageview')::int views,
      count(DISTINCT visitor_key) FILTER (WHERE visitor_key IS NOT NULL AND visitor_key <> '')::int visitors,
      count(*) FILTER (WHERE event_type = 'click')::int clicks,
      count(*) FILTER (WHERE event_type LIKE 'video%')::int videos,
      coalesce(avg(duration_ms) FILTER (WHERE event_type = 'exit' AND duration_ms IS NOT NULL AND label = 'time_on_page'), 0) avg_time_ms,
      coalesce(round(avg(value) FILTER (WHERE event_type = 'scroll_depth' AND value IS NOT NULL)), 0) avg_scroll
    FROM page_base GROUP BY path LIMIT 500
  ) s
),
hv AS (
  SELECT extract(dow FROM created_at)::int di, extract(hour FROM created_at)::int hi, count(*)::int cnt
  FROM base WHERE event_type = 'pageview' GROUP BY 1, 2
),
heatmap AS (
  SELECT jsonb_agg(row_data ORDER BY di) j FROM (
    SELECT d.di, jsonb_agg(coalesce(hv.cnt, 0) ORDER BY h.hi) row_data
    FROM generate_series(0, 6) d(di)
    CROSS JOIN generate_series(0, 23) h(hi)
    LEFT JOIN hv ON hv.di = d.di AND hv.hi = h.hi
    GROUP BY d.di
  ) g
),
click_points AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('x', c.x, 'y', c.y, 'vw', c.vw, 'vh', c.vh)), '[]'::jsonb) j FROM (
    SELECT
      (metadata->'click_coordinates'->>'x')::numeric x,
      (metadata->'click_coordinates'->>'y')::numeric y,
      coalesce((metadata->'viewport'->>'width')::numeric, 0) vw,
      coalesce((metadata->'viewport'->>'height')::numeric, 0) vh
    FROM base
    WHERE event_type = 'click'
      AND metadata->'click_coordinates'->>'x' ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND metadata->'click_coordinates'->>'y' ~ '^-?[0-9]+(\.[0-9]+)?$'
    ORDER BY created_at DESC
    LIMIT 4000
  ) c
),
video AS (
  SELECT jsonb_build_object(
    'plays', (SELECT count(DISTINCT session_id) FROM base WHERE event_type = 'video_play'),
    'milestones', coalesce((
      SELECT jsonb_agg(jsonb_build_object('milestone', m, 'sessions', coalesce(mm.cnt, 0)) ORDER BY m)
      FROM unnest(array[25, 50, 75, 95]) m
      LEFT JOIN (
        SELECT (metadata->>'milestone')::int ms, count(DISTINCT session_id)::int cnt
        FROM base
        WHERE event_type = 'video_progress' AND metadata->>'milestone' ~ '^[0-9]+$'
        GROUP BY 1
      ) mm ON mm.ms = m
    ), '[]'::jsonb)
  ) j FROM base LIMIT 1
),
sections AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('section', s.section, 'sessions', s.sessions, 'avg_ms', s.avg_ms) ORDER BY s.avg_ms DESC), '[]'::jsonb) j FROM (
    SELECT replace(label, 'section_time:', '') section, count(*)::int sessions, avg(duration_ms) avg_ms
    FROM base
    WHERE event_type = 'exit' AND duration_ms IS NOT NULL AND label LIKE 'section_time:%'
    GROUP BY 1 LIMIT 200
  ) s
),
plans AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('plan', p.plan, 'pageviews', p.pageviews, 'clicks', p.clicks, 'sessions', p.sessions) ORDER BY p.pageviews DESC), '[]'::jsonb) j FROM (
    SELECT coalesce(plan_type, 'anonymous') plan,
      count(*) FILTER (WHERE event_type = 'pageview')::int pageviews,
      count(*) FILTER (WHERE event_type = 'click')::int clicks,
      count(DISTINCT session_id) FILTER (WHERE event_type = 'pageview')::int sessions
    FROM base GROUP BY 1 LIMIT 50
  ) p
),
visitors AS (
  SELECT coalesce(jsonb_agg(v ORDER BY (v->>'views')::int + (v->>'clicks')::int DESC), '[]'::jsonb) j FROM (
    SELECT jsonb_build_object(
      'key', visitor_key,
      'ip', (array_remove(array_agg(ip_address ORDER BY created_at DESC), NULL))[1],
      'views', count(*) FILTER (WHERE event_type = 'pageview')::int,
      'clicks', count(*) FILTER (WHERE event_type = 'click')::int,
      'videos', count(*) FILTER (WHERE event_type LIKE 'video%')::int,
      'pages', to_jsonb(array_agg(DISTINCT path)),
      'country', (array_remove(array_agg(country ORDER BY created_at DESC), NULL))[1],
      'device', (array_remove(array_agg(device ORDER BY created_at DESC), NULL))[1],
      'email', (array_remove(array_agg(user_email ORDER BY created_at DESC), NULL))[1],
      'plan', (array_remove(array_agg(plan_type ORDER BY created_at DESC), NULL))[1],
      'source', coalesce(
        (array_remove(array_agg(utm_source ORDER BY created_at DESC), NULL))[1],
        (array_remove(array_agg(CASE WHEN referrer IS NOT NULL THEN regexp_replace(referrer, '^https?://([^/]+).*$', '\1') END ORDER BY created_at DESC), NULL))[1]
      ),
      'last', max(created_at)
    ) v
    FROM base
    WHERE visitor_key IS NOT NULL AND visitor_key <> ''
    GROUP BY visitor_key
    ORDER BY count(*) FILTER (WHERE event_type = 'pageview') + count(*) FILTER (WHERE event_type = 'click') DESC
    LIMIT 300
  ) vv
),
recent AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'path', path, 'event_type', event_type, 'label', label, 'plan_type', plan_type, 'ip_address', ip_address) ORDER BY created_at DESC), '[]'::jsonb) j
  FROM (SELECT * FROM base ORDER BY created_at DESC LIMIT 300) r
)
SELECT jsonb_build_object(
  'totals', (SELECT j FROM totals),
  'pages', (SELECT j FROM pages),
  'heatmap', (SELECT j FROM heatmap),
  'click_points', (SELECT j FROM click_points),
  'video', (SELECT j FROM video),
  'sections', (SELECT j FROM sections),
  'plans', (SELECT j FROM plans),
  'visitors', (SELECT j FROM visitors),
  'recent_events', (SELECT j FROM recent)
)
FROM totals
$$;

REVOKE EXECUTE ON FUNCTION public.page_analytics_summary(int, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.page_analytics_summary(int, text) TO authenticated, service_role;