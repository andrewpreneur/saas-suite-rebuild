CREATE TABLE public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text,
  visitor_key text,
  ip_address text,
  path text not null,
  page_title text,
  event_type text not null default 'pageview',
  label text,
  value numeric,
  duration_ms integer,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device text,
  browser text,
  country text,
  city text,
  region text,
  user_email text,
  metadata jsonb not null default '{}'::jsonb
);

CREATE INDEX site_analytics_events_created_idx ON public.site_analytics_events (created_at DESC);
CREATE INDEX site_analytics_events_path_idx ON public.site_analytics_events (path);
CREATE INDEX site_analytics_events_visitor_idx ON public.site_analytics_events (visitor_key);
CREATE INDEX site_analytics_events_type_idx ON public.site_analytics_events (event_type);

GRANT SELECT ON public.site_analytics_events TO authenticated;
GRANT ALL ON public.site_analytics_events TO service_role;

ALTER TABLE public.site_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin can view analytics events"
ON public.site_analytics_events FOR SELECT TO authenticated
USING (lower(coalesce(public.current_auth_email(), '')) = 'andrew@dna-media.net');