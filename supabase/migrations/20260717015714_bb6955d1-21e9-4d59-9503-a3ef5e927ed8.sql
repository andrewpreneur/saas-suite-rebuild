CREATE TABLE public.team_reply_webhook_throttle (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  agency_id TEXT,
  identifier TEXT NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX team_reply_webhook_throttle_key ON public.team_reply_webhook_throttle (source, COALESCE(agency_id,''), identifier);
GRANT ALL ON public.team_reply_webhook_throttle TO service_role;
ALTER TABLE public.team_reply_webhook_throttle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.team_reply_webhook_throttle FOR ALL USING (false) WITH CHECK (false);