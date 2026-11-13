CREATE TABLE IF NOT EXISTS public.support_wins_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.support_wins_cache TO service_role;
ALTER TABLE public.support_wins_cache ENABLE ROW LEVEL SECURITY;