CREATE TABLE public.webinar_ad_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'meta',
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  leads BIGINT NOT NULL DEFAULT 0,
  registrations BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  cpl NUMERIC,
  roas NUMERIC,
  notes TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, source)
);

CREATE TABLE public.webinar_ad_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.webinar_ad_snapshots(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_name TEXT,
  adset_name TEXT,
  status TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  leads BIGINT NOT NULL DEFAULT 0,
  registrations BIGINT NOT NULL DEFAULT 0,
  purchases BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC,
  cpc NUMERIC,
  cpl NUMERIC,
  roas NUMERIC,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webinar_ad_entities_snapshot ON public.webinar_ad_entities (snapshot_id, level);
CREATE INDEX idx_webinar_ad_snapshots_date ON public.webinar_ad_snapshots (snapshot_date DESC);

GRANT ALL ON public.webinar_ad_snapshots TO service_role;
GRANT ALL ON public.webinar_ad_entities TO service_role;

ALTER TABLE public.webinar_ad_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webinar_ad_entities ENABLE ROW LEVEL SECURITY;
