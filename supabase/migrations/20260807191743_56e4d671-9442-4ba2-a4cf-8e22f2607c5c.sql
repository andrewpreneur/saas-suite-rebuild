-- External platform monitoring connections
CREATE TABLE public.external_platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  owner_email text NOT NULL,
  platform_name text NOT NULL DEFAULT 'External Platform',
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  enabled boolean NOT NULL DEFAULT true,
  slack_notify boolean NOT NULL DEFAULT true,
  event_count integer NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_platform_connections TO authenticated;
GRANT ALL ON public.external_platform_connections TO service_role;

ALTER TABLE public.external_platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their external platform connections"
ON public.external_platform_connections
FOR ALL
TO authenticated
USING (lower(owner_email) = lower(public.current_auth_email()))
WITH CHECK (lower(owner_email) = lower(public.current_auth_email()));

CREATE INDEX idx_ext_platform_conn_owner ON public.external_platform_connections (lower(owner_email));
CREATE INDEX idx_ext_platform_conn_agency ON public.external_platform_connections (agency_id);

-- Login / activity events received from external platforms
CREATE TABLE public.external_platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.external_platform_connections(id) ON DELETE CASCADE,
  agency_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'user_login',
  user_email text,
  user_name text,
  external_user_id text,
  page_url text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.external_platform_events TO authenticated;
GRANT ALL ON public.external_platform_events TO service_role;

ALTER TABLE public.external_platform_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their external platform events"
ON public.external_platform_events
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.external_platform_connections c
  WHERE c.id = external_platform_events.connection_id
    AND lower(c.owner_email) = lower(public.current_auth_email())
));

CREATE INDEX idx_ext_platform_events_conn ON public.external_platform_events (connection_id, created_at DESC);
CREATE INDEX idx_ext_platform_events_email ON public.external_platform_events (lower(user_email), created_at DESC);

CREATE TRIGGER trg_ext_platform_conn_updated
BEFORE UPDATE ON public.external_platform_connections
FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();