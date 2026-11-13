ALTER TABLE public.site_analytics_events
  ADD COLUMN IF NOT EXISTS plan_type TEXT,
  ADD COLUMN IF NOT EXISTS is_app_page BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_replay_id UUID;

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_created_at_path
  ON public.site_analytics_events (created_at, path);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_session_created
  ON public.site_analytics_events (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_plan_created
  ON public.site_analytics_events (plan_type, created_at);